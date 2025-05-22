#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Modified from https://github.com/Jenderal92/reverse-ip-new-api

import requests
import xml.etree.ElementTree as ET
from multiprocessing.dummy import Pool as ThreadPool
import sys
import argparse
import json

def display_banner():
    print("=" * 50)
    print(" " * 10 + "Reverse IP Lookup Tool")
    print(" " * 10 + "TaraBot Integration")
    print("=" * 50)
    print("\n")

def reverse_ip(base_url, ip, initial_domain):
    try:
        reverse_domain = initial_domain
        all_domains = set()
        has_more = True

        while has_more:
            params = {
                'threepointoneipnum': ip,
                'reverse_domain': reverse_domain
            }
            response = requests.get(base_url, params=params, timeout=10)
            if response.status_code != 200:
                print(f"[ERROR] Failed to fetch data for: {initial_domain}")
                return all_domains

            root = ET.fromstring(response.content)
            result = root.find('result').text
            if result != 'ok':
                print(f"[ERROR] API returned an error for: {initial_domain}")
                return all_domains
            
            for child in root:
                if child.tag.startswith('domain_'):
                    domain = child.text.strip()
                    if domain not in all_domains:
                        all_domains.add(domain)

            has_more = root.find('has_more').text == '1'
            if has_more:
                reverse_domain = root.find('last_domain_punycode').text
            else:
                break

        return all_domains

    except Exception as e:
        print(f"[ERROR] Exception for: {initial_domain} - {str(e)}")
        return set()

def generate_threepointoneipnum(ip):
    parts = ip.split('.')
    formatted_parts = ["%03d" % int(part) for part in parts]
    return "_{}".format("".join(formatted_parts))
    
def process_ip(ip):
    base_url = "https://atsameip.intercode.ca/xmlloadIPpage2.php"
    threepointoneipnum = generate_threepointoneipnum(ip)
    print(f"[INFO] Processing IP: {ip}")
    print(f"[INFO] Threepointoneipnum: {threepointoneipnum}")
    found_domains = reverse_ip(base_url, threepointoneipnum, ip)
    print(f"[INFO] Found {len(found_domains)} domains for {ip}")
    return found_domains

def main():
    parser = argparse.ArgumentParser(description='Reverse IP Lookup Tool')
    parser.add_argument('--ip', type=str, help='Single IP address to lookup')
    parser.add_argument('--file', type=str, help='File with list of IPs')
    parser.add_argument('--threads', type=int, default=5, help='Number of threads')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    parser.add_argument('--output', type=str, help='Output file (default: result.txt)')
    
    args = parser.parse_args()
    
    if not args.ip and not args.file:
        parser.print_help()
        sys.exit(1)
    
    if not args.json:
        display_banner()
    
    ip_list = []
    if args.ip:
        ip_list = [args.ip]
    elif args.file:
        try:
            with open(args.file, 'r') as f:
                ip_list = f.read().splitlines()
        except Exception as e:
            print(f"[ERROR] Could not read file: {str(e)}")
            sys.exit(1)
    
    pool = ThreadPool(args.threads)
    results = pool.map(process_ip, ip_list)
    
    all_results = set()
    ip_to_domains = {}
    
    for i, res in enumerate(results):
        ip = ip_list[i]
        domains = list(res)
        all_results.update(res)
        ip_to_domains[ip] = domains
    
    if args.json:
        output = {
            "total": len(all_results),
            "ip_domains": ip_to_domains,
            "all_domains": list(all_results)
        }
        print(json.dumps(output))
    else:
        output_file = args.output or "result.txt"
        with open(output_file, "w") as result_file:
            for domain in sorted(all_results):
                result_file.write(domain + "\n")
        
        print(f"\n[INFO] Total unique domains found: {len(all_results)}")
        print(f"[INFO] Results saved to {output_file}")
    
    pool.close()
    pool.join()

if __name__ == '__main__':
    if len(sys.argv) == 2 and not sys.argv[1].startswith('-'):
        # Simple mode for direct command line use
        domains = process_ip(sys.argv[1])
        for domain in sorted(domains):
            print(domain)
    else:
        main()
