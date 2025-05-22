#!/bin/bash

# SubFinder aracını yüklemek için betik
echo "SubFinder aracı yükleniyor..."

# İşletim sistemini kontrol et
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "Linux işletim sistemi tespit edildi."
    
    # Go yüklü mü kontrol et
    if ! command -v go &> /dev/null; then
        echo "Go yüklü değil. Lütfen önce Go'yu yükleyin."
        echo "Yükleme kılavuzu: https://golang.org/doc/install"
        exit 1
    fi
    
    # SubFinder'ı yükle
    echo "SubFinder yükleniyor..."
    go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
    
    # PATH'e eklenip eklenmediğini kontrol et
    if ! command -v subfinder &> /dev/null; then
        echo "SubFinder yüklendi fakat PATH'e eklenmedi."
        echo "Lütfen aşağıdaki komutu çalıştırın veya .bashrc dosyanıza ekleyin:"
        echo "export PATH=$PATH:$HOME/go/bin"
    else
        echo "SubFinder başarıyla yüklendi!"
    fi
    
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "macOS işletim sistemi tespit edildi."
    
    # Homebrew yüklü mü kontrol et
    if ! command -v brew &> /dev/null; then
        echo "Homebrew yüklü değil. Lütfen önce Homebrew'i yükleyin."
        echo "Yükleme komutu: /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
    
    # SubFinder'ı yükle
    echo "SubFinder yükleniyor..."
    brew install subfinder
    
    # Yükleme başarılı mı kontrol et
    if ! command -v subfinder &> /dev/null; then
        echo "SubFinder yüklenirken bir hata oluştu."
    else
        echo "SubFinder başarıyla yüklendi!"
    fi
    
else
    # Diğer işletim sistemleri
    echo "Desteklenmeyen işletim sistemi: $OSTYPE"
    echo "Lütfen SubFinder'ı manuel olarak yükleyin: https://github.com/projectdiscovery/subfinder#installation"
    exit 1
fi

# Yükleme sonrası kontrol
if command -v subfinder &> /dev/null; then
    echo "SubFinder sürümü:"
    subfinder -version
    
    echo ""
    echo "SubFinder kullanım kılavuzu:"
    subfinder -h
else
    echo "SubFinder yüklenemedi veya PATH'e eklenemedi."
fi 