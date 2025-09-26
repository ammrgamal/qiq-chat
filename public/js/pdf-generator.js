// PDF Generator with Branding
class PDFGenerator {
    constructor() {
        this.jsPDF = null;
        this.qrcode = null;
        this.loadDependencies();
        
        console.log('📄 PDF Generator initialized');
    }
    
    async loadDependencies() {
        try {
            // Load jsPDF
            if (!window.jsPDF) {
                await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            }
            
            // Load QR Code library
            if (!window.QRCode) {
                await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js');
            }
            
            this.jsPDF = window.jsPDF?.jsPDF || window.jsPDF;
            console.log('✅ PDF dependencies loaded');
            
        } catch (error) {
            console.error('Failed to load PDF dependencies:', error);
        }
    }
    
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    async generateQuotePdf(items, total) {
        if (!this.jsPDF) {
            throw new Error('PDF library not loaded');
        }
        
        const doc = new this.jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        // Set Arabic font support (if available)
        try {
            // For Arabic text support, you'd need to load Arabic fonts
            // For now, we'll use default fonts with English/transliterated text
            doc.setFont('helvetica');
        } catch (error) {
            console.warn('Arabic font not available, using default');
        }
        
        await this.addHeader(doc);
        this.addQuoteInfo(doc);
        await this.addItemsTable(doc, items, total);
        this.addFooter(doc);
        
        return doc.output('arraybuffer');
    }
    
    async addHeader(doc) {
        // Company Logo (if available)
        try {
            const logoUrl = '/logo.png';
            const logoImg = await this.loadImage(logoUrl);
            doc.addImage(logoImg, 'PNG', 15, 15, 30, 15);
        } catch (error) {
            // If logo not available, add text logo
            doc.setFontSize(24);
            doc.setTextColor(255, 215, 0); // Gold color
            doc.text('QuickITQuote', 15, 25);
        }
        
        // Company Info
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('QuickITQuote - IT Solutions Provider', 15, 35);
        doc.text('Email: info@quickitquote.com', 15, 40);
        doc.text('Phone: +966 50 123 4567', 15, 45);
        
        // Quote Title
        doc.setFontSize(20);
        doc.setTextColor(255, 215, 0);
        doc.text('QUOTATION', 150, 25);
        
        // Divider line
        doc.setDrawColor(255, 215, 0);
        doc.setLineWidth(0.5);
        doc.line(15, 50, 195, 50);
    }
    
    addQuoteInfo(doc) {
        const currentDate = new Date().toLocaleDateString('en-GB');
        const quoteNumber = `QIQ-AI-${Date.now().toString().slice(-6)}`;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        // Quote details box
        doc.rect(15, 60, 180, 25);
        doc.setFillColor(245, 245, 245);
        doc.rect(15, 60, 180, 8, 'F');
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Quote Details', 20, 66);
        
        doc.setFontSize(10);
        doc.text(`Quote Number: ${quoteNumber}`, 20, 75);
        doc.text(`Date: ${currentDate}`, 20, 80);
        doc.text('Valid Until: ' + new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('en-GB'), 120, 75);
        doc.text('Status: Draft', 120, 80);
    }
    
    async addItemsTable(doc, items, total) {
        let yPosition = 100;
        
        // Table header
        doc.setFillColor(255, 215, 0);
        doc.rect(15, yPosition, 180, 10, 'F');
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('#', 18, yPosition + 7);
        doc.text('Product Name', 30, yPosition + 7);
        doc.text('Qty', 120, yPosition + 7);
        doc.text('Unit Price (SAR)', 140, yPosition + 7);
        doc.text('Total (SAR)', 170, yPosition + 7);
        
        yPosition += 15;
        
        // Table items
        doc.setFillColor(255, 255, 255);
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const unitPrice = parseFloat(item.product.price.replace(/[^\d.]/g, ''));
            const itemTotal = unitPrice * item.quantity;
            
            // Alternate row colors
            if (i % 2 === 1) {
                doc.setFillColor(248, 248, 248);
                doc.rect(15, yPosition - 5, 180, 12, 'F');
            }
            
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            
            // Row content
            doc.text((i + 1).toString(), 18, yPosition + 2);
            
            // Product name (truncate if too long)
            const productName = item.product.name.length > 35 ? 
                              item.product.name.substring(0, 35) + '...' : 
                              item.product.name;
            doc.text(productName, 30, yPosition + 2);
            
            doc.text(item.quantity.toString(), 125, yPosition + 2);
            doc.text(unitPrice.toFixed(2), 145, yPosition + 2);
            doc.text(itemTotal.toFixed(2), 175, yPosition + 2);
            
            // Add product description on next line if space allows
            if (item.product.description && yPosition < 220) {
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                const description = item.product.description.length > 50 ? 
                                 item.product.description.substring(0, 50) + '...' : 
                                 item.product.description;
                doc.text(description, 30, yPosition + 7);
                yPosition += 12;
            } else {
                yPosition += 10;
            }
            
            // Add new page if needed
            if (yPosition > 250) {
                doc.addPage();
                yPosition = 30;
            }
        }
        
        // Totals section
        yPosition += 10;
        doc.setDrawColor(255, 215, 0);
        doc.setLineWidth(1);
        doc.line(120, yPosition, 195, yPosition);
        
        yPosition += 8;
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Subtotal:', 130, yPosition);
        doc.text(total.toFixed(2) + ' SAR', 175, yPosition, { align: 'right' });
        
        yPosition += 8;
        const vat = total * 0.15;
        doc.text('VAT (15%):', 130, yPosition);
        doc.text(vat.toFixed(2) + ' SAR', 175, yPosition, { align: 'right' });
        
        yPosition += 10;
        doc.setFontSize(14);
        doc.setTextColor(255, 215, 0);
        doc.setDrawColor(255, 215, 0);
        doc.rect(120, yPosition - 5, 75, 10);
        doc.text('Total:', 130, yPosition + 2);
        doc.text((total + vat).toFixed(2) + ' SAR', 175, yPosition + 2, { align: 'right' });
    }
    
    addFooter(doc) {
        const pageHeight = doc.internal.pageSize.height;
        
        // Terms and conditions
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('Terms & Conditions:', 15, pageHeight - 30);
        doc.text('• This quote is valid for 30 days from the date of issue.', 15, pageHeight - 25);
        doc.text('• Prices are in Saudi Riyals and include VAT.', 15, pageHeight - 20);
        doc.text('• Delivery terms and installation costs may apply.', 15, pageHeight - 15);
        
        // QR Code for digital verification (if QR library is available)
        try {
            const qrData = `Quote: QIQ-AI-${Date.now().toString().slice(-6)}`;
            // Add QR code placeholder
            doc.setDrawColor(200, 200, 200);
            doc.rect(170, pageHeight - 35, 20, 20);
            doc.setFontSize(6);
            doc.text('QR Code', 175, pageHeight - 25);
        } catch (error) {
            console.warn('QR Code generation not available');
        }
        
        // Company footer
        doc.setDrawColor(255, 215, 0);
        doc.setLineWidth(0.5);
        doc.line(15, pageHeight - 10, 195, pageHeight - 10);
        
        doc.setFontSize(8);
        doc.setTextColor(255, 215, 0);
        doc.text('QuickITQuote - Your Trusted IT Solutions Partner', 105, pageHeight - 5, { align: 'center' });
    }
    
    loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.pdfGenerator = new PDFGenerator();
    console.log('📄 PDF Generator initialized');
});