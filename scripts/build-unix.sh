#!/bin/bash

# ==================================================
# CLIPBOARDFILTER - Unix Build Script
# Compile ClipboardFilter for Linux and macOS
# ==================================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "  CLIPBOARDFILTER - UNIX BUILD"
echo "=========================================="
echo ""

# Detect OS
OS_TYPE=""
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS_TYPE="linux"
    echo -e "${GREEN}Detected OS: Linux${NC}"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS_TYPE="macos"
    echo -e "${GREEN}Detected OS: macOS${NC}"
else
    echo -e "${RED}❌ ERROR: Unsupported OS: $OSTYPE${NC}"
    echo "This script supports Linux and macOS only"
    exit 1
fi

echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
echo -e "${YELLOW}[1/5] Checking dependencies...${NC}"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js not found${NC}"
    echo ""
    if [[ "$OS_TYPE" == "macos" ]]; then
        echo "Install with Homebrew:"
        echo "  brew install node"
    else
        echo "Install Node.js 18+ from https://nodejs.org/"
    fi
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi

echo -e "  ${GREEN}✓ Node.js $(node --version)${NC}"
echo -e "  ${GREEN}✓ npm $(npm --version)${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo ""
    echo -e "${YELLOW}[2/5] Installing dependencies...${NC}"
    npm install
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ npm install failed!${NC}"
        exit 1
    fi
else
    echo ""
    echo -e "${YELLOW}[2/5] Dependencies already installed${NC}"
fi

# Clean previous builds
echo ""
echo -e "${YELLOW}[3/5] Cleaning previous builds...${NC}"
rm -rf dist/ build/ release/
echo -e "  ${GREEN}✓ Clean complete${NC}"

# Build TypeScript
echo ""
echo -e "${YELLOW}[4/5] Building TypeScript...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo -e "  ${GREEN}✓ TypeScript compiled${NC}"

# Build packages based on OS
echo ""
echo -e "${YELLOW}[5/5] Building packages...${NC}"
echo ""

if [[ "$OS_TYPE" == "linux" ]]; then
    # Linux packages
    echo -e "${CYAN}Select Linux packages to build:${NC}"
    echo "  [1] AppImage (universal)"
    echo "  [2] deb (Debian/Ubuntu)"
    echo "  [3] rpm (Fedora/RHEL)"
    echo "  [4] pacman (Arch Linux)"
    echo "  [5] All packages"
    echo ""
    read -p "Your choice (1-5): " choice
    
    case $choice in
        1)
            echo ""
            echo "Building AppImage..."
            npm run package:linux:appimage
            ;;
        2)
            echo ""
            echo "Building .deb..."
            npm run package:linux:deb
            ;;
        3)
            echo ""
            echo "Building .rpm..."
            npm run package:linux:rpm
            ;;
        4)
            echo ""
            echo "Building .pacman..."
            npm run package:linux:pacman
            ;;
        5)
            echo ""
            echo "Building all packages..."
            npm run package:linux:appimage
            npm run package:linux:deb
            npm run package:linux:rpm
            npm run package:linux:pacman
            ;;
        *)
            echo -e "${RED}❌ Invalid choice${NC}"
            exit 1
            ;;
    esac
    
elif [[ "$OS_TYPE" == "macos" ]]; then
    # macOS packages
    echo -e "${CYAN}Select macOS package format:${NC}"
    echo "  [1] DMG (recommended)"
    echo "  [2] ZIP"
    echo "  [3] Both"
    echo ""
    read -p "Your choice (1-3): " choice
    
    case $choice in
        1|2|3)
            echo ""
            echo "Building macOS packages..."
            npm run package:mac
            ;;
        *)
            echo -e "${RED}❌ Invalid choice${NC}"
            exit 1
            ;;
    esac
fi

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ Package build failed!${NC}"
    exit 1
fi

# Show results
echo ""
echo "=========================================="
echo -e "  ${GREEN}BUILD COMPLETE!${NC}"
echo "=========================================="
echo ""

if [ -d "release" ]; then
    echo -e "${YELLOW}Generated packages:${NC}"
    echo ""
    
    if [[ "$OS_TYPE" == "linux" ]]; then
        # List Linux packages
        for ext in AppImage deb rpm pacman; do
            if ls release/*.$ext 1> /dev/null 2>&1; then
                ls -lh release/*.$ext | awk -v ext="$ext" '{printf "  📦 %-12s %s (%s)\n", "[" toupper(ext) "]", $9, $5}'
            fi
        done
        
        total=$(ls -1 release/*.{AppImage,deb,rpm,pacman} 2>/dev/null | wc -l)
        echo ""
        echo -e "${CYAN}Total: $total package(s)${NC}"
        
    elif [[ "$OS_TYPE" == "macos" ]]; then
        # List macOS packages
        for ext in dmg zip; do
            if ls release/*.$ext 1> /dev/null 2>&1; then
                ls -lh release/*.$ext | awk -v ext="$ext" '{printf "  📦 %-12s %s (%s)\n", "[" toupper(ext) "]", $9, $5}'
            fi
        done
        
        total=$(ls -1 release/*.{dmg,zip} 2>/dev/null | wc -l)
        echo ""
        echo -e "${CYAN}Total: $total package(s)${NC}"
        
        echo ""
        echo -e "${YELLOW}⚠️  Note: For distribution, you should code sign the app:${NC}"
        echo "   1. Get an Apple Developer certificate"
        echo "   2. Set CSC_LINK and CSC_KEY_PASSWORD environment variables"
        echo "   3. Rebuild with signing enabled"
    fi
fi

echo ""
echo -e "${GREEN}Ready for distribution! 🚀${NC}"
echo ""
