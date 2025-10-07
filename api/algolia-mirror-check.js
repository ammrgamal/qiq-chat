// /api/algolia/mirror-check - runs or returns cached mirror integrity report
import { runMirrorCheck, getLastMirrorReport } from '../rules-engine/src/mirrorChecker.js';

export default async function handler(req, res){
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET');
    return res.status(405).json({ ok:false, error:'method_not_allowed' });
  }
  const force = req.query.full === '1' || req.query.force === '1';
  // Basic guard: only allow if SEARCH_DEBUG=1 or explicit env flag
  if (process.env.SEARCH_DEBUG !== '1' && process.env.MIRROR_CHECK_ENABLE !== '1') {
    const last = getLastMirrorReport();
    return res.status(403).json({ ok:false, error:'disabled', lastAvailable: last });
  }
  try {
    const report = await runMirrorCheck({ force });
    return res.status(200).json(report);
  } catch (e) {
    return res.status(500).json({ ok:false, error:'mirror_check_failed', detail: e.message });
  }
}
