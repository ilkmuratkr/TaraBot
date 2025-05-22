#!/usr/bin/env python3
import requests
import re
import sys
from bs4 import BeautifulSoup

def reverse_ip_lookup(ip):
    url = "https://dnsdumpster.com/"
    
    # İlk istek - CSRF token almak için
    session = requests.Session()
    r = session.get(url)
    
    # CSRF token'ı al
    soup = BeautifulSoup(r.text, 'html.parser')
    csrf_token = soup.find('input', {'name': 'csrfmiddlewaretoken'}).get('value')
    
    if not csrf_token:
        print("CSRF token alınamadı.")
        return []
    
    # POST isteği
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': url,
    }
    
    data = {
        'csrfmiddlewaretoken': csrf_token,
        'targetip': ip,
        'user': 'free'
    }
    
    response = session.post(url, headers=headers, data=data)
    
    if response.status_code != 200:
        print(f"HTTP Hatası: {response.status_code}")
        return []
    
    # Yanıtı analiz et
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Domain tablosunu ara
    tables = soup.find_all('table', {'class': 'table'})
    domains = set()
    
    for table in tables:
        rows = table.find_all('tr')
        for row in rows:
            cells = row.find_all('td')
            if len(cells) >= 2:
                domain_cell = cells[0].text.strip()
                # Domain hücresinden sadece domaini çıkar
                if domain_cell and '.' in domain_cell:
                    domains.add(domain_cell)
    
    if domains:
        print(f"Toplam {len(domains)} domain bulundu:")
        for domain in sorted(domains):
            print(domain)
    else:
        print("Bu IP için domain bulunamadı.")
    
    return domains

if __name__ == "__main__":
    if len(sys.argv) > 1:
        ip = sys.argv[1]
        reverse_ip_lookup(ip)
    else:
        print("Kullanım: python3 dnsdumpster_test.py [IP_ADRESİ]") 