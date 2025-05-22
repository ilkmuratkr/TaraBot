#!/usr/bin/env python3
import requests
import sys
import json

def reverse_ip_lookup(ip):
    url = "https://domains.yougetsignal.com/domains.php"
    
    # POST isteği için gerekli parametreler
    data = {
        "remoteAddress": ip,
        "key": "",
        "domain": ""
    }
    
    # User-Agent ekleyerek bot olarak algılanmayı önlüyoruz
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://www.yougetsignal.com",
        "Referer": "https://www.yougetsignal.com/tools/web-sites-on-web-server/"
    }
    
    try:
        response = requests.post(url, data=data, headers=headers, timeout=15)
        
        if response.status_code == 200:
            result = response.json()
            
            if result.get("status") == "Success":
                domains = result.get("domainArray", [])
                print(f"Toplam {len(domains)} domain bulundu:")
                
                for domain in domains:
                    if domain[0]:  # Boş olmayan domainleri yazdır
                        print(domain[0])
                
                return domains
            else:
                print(f"Hata: {result.get('message', 'Bilinmeyen hata')}")
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
        print("Kullanım: python3 youget_test.py [IP_ADRESİ]") 