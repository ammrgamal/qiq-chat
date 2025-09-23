/**
 * Generate a comprehensive Markdown index of the project.
 * - File tree (condensed)
 * - Quick stats
 * - API folder overview
 * - Setup notes (docs/SETUP.md if present)
 * - Copilot instructions/tasks (docs/COPILOT_INSTRUCTIONS.md if present)
 *
 * Usage:
 *   node scripts/generate-index.mjs [rootDir=.]
 */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const ROOT = path.resolve(process.argv[2] || process.cwd());
const OUT = path.join(ROOT, 'PROJECT_INDEX.md');
const EXCLUDE_DIRS = new Set([
  'node_modules','.git','.next','dist','build','out','.vercel','.cache',
  'coverage','.vscode','.idea','tmp','temp','.turbo','\.husky','logs'
]);
const MAX_DEPTH = 6;
const MAX_ENTRIES = 6000;

const exists = async (p) => !!(await fsp.stat(p).catch(()=>null));
const statSafe = async (p) => { try{ return await fsp.stat(p);}catch{ return null; } };
const isExcludedDir = (name) => EXCLUDE_DIRS.has(name);

async function walk(dir, depth=0, entries={n:0}){
  const result = { name: path.basename(dir), path: dir, type:'dir', size:0, children:[] };
  if (depth > MAX_DEPTH) return result;
  let items;
  try { items = await fsp.readdir(dir, { withFileTypes:true }); } catch { return result; }
  items.sort((a,b)=> (a.isDirectory()===b.isDirectory()? a.name.localeCompare(b.name) : (a.isDirectory()? -1:1)));
  for (const d of items) {
    if (entries.n > MAX_ENTRIES) break;
    if (d.isDirectory()) {
      if (isExcludedDir(d.name)) continue;
      const child = await walk(path.join(dir,d.name), depth+1, entries);
      result.children.push(child);
      result.size += child.size;
    } else {
      const fp = path.join(dir, d.name);
      const st = await statSafe(fp);
      const sz = st?.size||0;
      result.children.push({ name:d.name, path:fp, type:'file', size:sz });
      result.size += sz;
      entries.n++;
    }
  }
  return result;
}

function human(n){ if(n<1024) return `${n} B`; if(n<1024*1024) return `${(n/1024).toFixed(1)} KB`; if(n<1024*1024*1024) return `${(n/1024/1024).toFixed(1)} MB`; return `${(n/1024/1024/1024).toFixed(2)} GB`; }

function renderTree(node, prefix='', isLast=true, depth=0){
  const lines=[];
  const connector = depth===0? '' : (isLast?'└── ':'├── ');
  const label = node.type==='dir' ? `${node.name}/` : node.name;
  const size = node.type==='dir' ? '' : ` (${human(node.size)})`;
  lines.push(prefix+connector+label+size);
  if (node.type==='dir' && node.children?.length){
    const newPrefix = prefix + (depth===0?'':(isLast?'    ':'│   '));
    node.children.forEach((c, i)=>{
      const last = i===node.children.length-1;
      lines.push(...renderTree(c, newPrefix, last, depth+1));
    });
  }
  return lines;
}

function count(node){
  let files=0, dirs=0;
  if (node.type==='dir'){ dirs++; for(const c of node.children||[]){ const r=count(c); files+=r.files; dirs+=r.dirs; } }
  else files++;
  return {files, dirs};
}

async function readIfExists(fp){
  try { return await fsp.readFile(fp, 'utf8'); } catch { return ''; }
}

async function apiOverview(root){
  const apiDir = path.join(root, 'api');
  if (!await exists(apiDir)) return '';
  const parts = ['## API overview (by files)\n'];
  async function list(dir, level=0){
    let items; try { items = await fsp.readdir(dir, { withFileTypes:true }); } catch { return; }
    items.sort((a,b)=> (a.isDirectory()===b.isDirectory()? a.name.localeCompare(b.name) : (a.isDirectory()? -1:1)));
    for (const it of items){
      const fp = path.join(dir, it.name);
      const rel = path.relative(root, fp).replace(/\\/g,'/');
      if (it.isDirectory()) {
        parts.push(`${'  '.repeat(level)}- ${it.name}/`);
        await list(fp, level+1);
      } else {
        parts.push(`${'  '.repeat(level)}- ${rel}`);
      }
    }
  }
  await list(apiDir, 0);
  parts.push('\n');
  return parts.join('\n');
}

async function main(){
  const tree = await walk(ROOT);
  const {files, dirs} = count(tree);
  const treeLines = renderTree(tree).join('\n');
  const title = `# Project Index — ${path.basename(ROOT)}\nGenerated: ${new Date().toISOString()}\n\n`;
  const stats = `- Root: ${ROOT}\n- Total size: ${human(tree.size)}\n- Files: ${files}\n- Directories: ${dirs}\n- Max depth: ${MAX_DEPTH}\n- Excluded dirs: ${[...EXCLUDE_DIRS].join(', ')}\n\n`;
  const guidance = `This file is auto-generated. Share it with ChatGPT for context.\n\n`;
  const fence = '```';
  const treeSection = `## Tree (truncated)\n\n${fence}\n${treeLines}\n${fence}\n\n`;
  const api = await apiOverview(ROOT);
  const setup = await readIfExists(path.join(ROOT, 'docs', 'SETUP.md'));
  const copilot = await readIfExists(path.join(ROOT, 'docs', 'COPILOT_INSTRUCTIONS.md'));
  const projInstr = await readIfExists(path.join(ROOT, 'project-instructions.md'));
  const setupSection = setup ? `## Setup notes\n\n${setup}\n\n` : '';
  const copilotSection = copilot ? `## Copilot instructions / tasks\n\n${copilot}\n\n` : '';
  const projectInstructionsSection = projInstr ? `## Project instructions\n\n${projInstr}\n\n` : '';
  const md = title + stats + guidance + api + treeSection + setupSection + copilotSection + projectInstructionsSection;
  await fsp.writeFile(OUT, md, 'utf8');
  console.log(`Wrote: ${OUT}`);
}

main().catch(err=>{ console.error(err); process.exit(1); });
