import { exec } from 'child_process';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { ip } = req.query;
  
  if (!ip) {
    return res.status(400).json({ error: 'IP adresi gerekli' });
  }
  
  // IP adresinin geçerli olup olmadığını kontrol ediyoruz
  const ipPattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipPattern.test(ip)) {
    return res.status(400).json({ error: 'Geçersiz IP adresi formatı' });
  }

  try {
    const scriptPath = path.join(process.cwd(), 'public', 'scripts', 'rapiddns_api.py');
    
    const result = await new Promise((resolve, reject) => {
      // Python scriptini çalıştırıyoruz
      exec(`python3 ${scriptPath} ${ip}`, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('Reverse IP lookup hatası:', error);
          console.error('stderr:', stderr);
          reject(error);
          return;
        }
        
        try {
          // JSON çıktısını parse ediyoruz
          const data = JSON.parse(stdout);
          resolve(data);
        } catch (parseError) {
          console.error('JSON parse hatası:', parseError);
          reject(new Error('JSON parse hatası'));
        }
      });
    });

    // API'den gelen sonuç hatalı ise
    if (result.status === 'error') {
      return res.status(500).json({
        error: 'RapidDNS API hatası',
        message: result.message
      });
    }

    // Başarılı sonuç dönüyoruz
    return res.status(200).json({ 
      ip, 
      domains: result.domains, 
      count: result.domains.length 
    });
  } catch (error) {
    console.error('Reverse IP lookup hatası:', error);
    return res.status(500).json({ 
      error: 'Sunucu hatası', 
      message: error.message 
    });
  }
} 