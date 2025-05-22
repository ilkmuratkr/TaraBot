#!/usr/bin/env python3
import requests
import re
import sys
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
                print("Tablo bulunamadı.")
                return []
            
            domains = []
            rows = table.find_all('tr')
            
            # İlk satır başlık olduğu için atlıyoruz
            for row in rows[1:]:
                cells = row.find_all('td')
                if cells and len(cells) > 0:
                    domain = cells[0].text.strip()
                    if domain:
                        domains.append(domain)
            
            print(f"Toplam {len(domains)} domain bulundu:")
            for domain in domains:
                print(domain)
            
            return domains
        else:
            print(f"HTTP Hatası: {response.status_code}")
    
    except Exception as e:
        print(f"Hata oluştu: {str(e)}")
    
    return []

if __name__ == "__main__":
    if len(sys.argv) > 1:
        ip = sys.argv[1]
        reverse_ip_lookup(ip)
    else:
        print("Kullanım: python3 rapiddns_test.py [IP_ADRESİ]") 