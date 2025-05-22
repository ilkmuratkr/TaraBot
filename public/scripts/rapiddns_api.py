#!/usr/bin/env python3
import requests
import sys
import json
from bs4 import BeautifulSoup

def reverse_ip_lookup(ip):
    url = f"https://rapiddns.io/sameip/{ip}?full=1"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Tablodaki domain hücrelerini bul
            table = soup.find('table', {'class': 'table'})
            if not table:
                return {"status": "error", "message": "Tablo bulunamadı.", "domains": []}
            
            domains = []
            rows = table.find_all('tr')
            
            # İlk satır başlık olduğu için atlıyoruz
            for row in rows[1:]:
                cells = row.find_all('td')
                if cells and len(cells) > 0:
                    domain = cells[0].text.strip()
                    if domain:
                        domains.append(domain)
            
            return {"status": "success", "count": len(domains), "domains": domains}
        else:
            return {"status": "error", "message": f"HTTP Hatası: {response.status_code}", "domains": []}
    
    except Exception as e:
        return {"status": "error", "message": f"Hata oluştu: {str(e)}", "domains": []}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        ip = sys.argv[1]
        result = reverse_ip_lookup(ip)
        print(json.dumps(result))
    else:
        print(json.dumps({"status": "error", "message": "IP adresi parametre olarak verilmelidir.", "domains": []})) 