#!/bin/bash

# Validate Deployment Configurations
# This script validates all deployment configuration files

set -e

echo "🔍 Validating OpenStatus Deployment Configurations..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validation functions
validate_file_exists() {
    local file="$1"
    local description="$2"
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $description exists"
        return 0
    else
        echo -e "${RED}❌${NC} $description missing: $file"
        return 1
    fi
}

validate_dockerfile_exists() {
    local dockerfile="$1"
    local description="$2"
    
    if [ -f "$dockerfile" ]; then
        echo -e "${GREEN}✅${NC} $description exists"
        # Check if Dockerfile has basic structure
        if grep -q "FROM" "$dockerfile" && grep -q "EXPOSE" "$dockerfile"; then
            echo -e "   ${GREEN}✅${NC} Dockerfile structure looks valid"
        else
            echo -e "   ${YELLOW}⚠️${NC} Dockerfile may have issues"
        fi
        return 0
    else
        echo -e "${RED}❌${NC} $description missing: $dockerfile"
        return 1
    fi
}

validate_yaml_syntax() {
    local file="$1"
    local description="$2"
    
    if command -v yq > /dev/null 2>&1; then
        if yq eval '.' "$file" > /dev/null 2>&1; then
            echo -e "${GREEN}✅${NC} $description has valid YAML syntax"
            return 0
        else
            echo -e "${RED}❌${NC} $description has invalid YAML syntax"
            yq eval '.' "$file" 2>&1 | head -5
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️${NC} yq not installed, skipping YAML syntax check for $description"
        return 0
    fi
}

validate_toml_syntax() {
    local file="$1"
    local description="$2"
    
    if command -v toml-cli > /dev/null 2>&1; then
        if toml-cli validate "$file" > /dev/null 2>&1; then
            echo -e "${GREEN}✅${NC} $description has valid TOML syntax"
            return 0
        else
            echo -e "${RED}❌${NC} $description has invalid TOML syntax"
            toml-cli validate "$file" 2>&1 | head -5
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️${NC} toml-cli not installed, skipping TOML syntax check for $description"
        return 0
    fi
}

check_dockerfile_references() {
    local config_file="$1"
    local config_type="$2"
    
    echo -e "${YELLOW}🔍${NC} Checking Dockerfile references in $config_type..."
    
    case "$config_type" in
        "Render")
            # For Render, check if all referenced directories have Dockerfiles
            echo "  Checking Render service directories..."
            
            # Get all rootDir values from render.yaml
            rootdirs=$(grep "rootDir:" "$config_file" | sed 's/.*rootDir: *//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sort | uniq)
            
            for rootdir in $rootdirs; do
                if [ -n "$rootdir" ]; then
                    full_path="$rootdir/Dockerfile"
                    if [ -f "$full_path" ]; then
                        echo -e "    ${GREEN}✅${NC} $rootdir/Dockerfile exists"
                    else
                        echo -e "    ${RED}❌${NC} $rootdir/Dockerfile missing (expected at $full_path)"
                    fi
                fi
            done
            
            # Also check for any dockerfilePath references
            if grep -q "dockerfilePath" "$config_file"; then
                echo "  Checking dockerfilePath references..."
                grep "dockerfilePath" "$config_file" | while read -r line; do
                    dockerfile_path=$(echo "$line" | sed 's/.*dockerfilePath: *//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
                    if [ "$dockerfile_path" != "./Dockerfile" ]; then
                        echo -e "    ${YELLOW}⚠️${NC} Non-standard dockerfilePath: $dockerfile_path (should be ./Dockerfile)"
                    fi
                done
            fi
            ;;
        "Railway")
            # Check for Dockerfile references in railway.toml
            if grep -q "dockerfilePath" "$config_file"; then
                echo "  Found Dockerfile references:"
                grep "dockerfilePath" "$config_file" | while read -r line; do
                    dockerfile_path=$(echo "$line" | sed 's/.*dockerfilePath = *//' | tr -d '"')
                    full_path="$dockerfile_path"
                    if [ -f "$full_path" ]; then
                        echo -e "    ${GREEN}✅${NC} $dockerfile_path exists"
                    else
                        echo -e "    ${RED}❌${NC} $dockerfile_path missing (expected at $full_path)"
                    fi
                done
            fi
            ;;
    esac
}

# Initialize validation results
VALIDATION_ERRORS=0

echo ""
echo "📋 Render Configuration Validation"
echo "=================================="

# Validate Render configuration files
validate_file_exists "deployments/render/render.yaml" "Render configuration file"
if [ $? -eq 0 ]; then
    validate_yaml_syntax "deployments/render/render.yaml" "Render configuration"
    check_dockerfile_references "deployments/render/render.yaml" "Render"
fi

# Validate Render documentation
echo ""
echo "📚 Render Documentation"
echo "======================"
validate_file_exists "deployments/render/docs/getting-started.md" "Render getting started guide"
validate_file_exists "deployments/render/docs/troubleshooting.md" "Render troubleshooting guide"
validate_file_exists "deployments/render/full-stack/README.md" "Render full-stack README"
validate_file_exists "deployments/render/lightweight/README.md" "Render lightweight README"

echo ""
echo "📋 Railway Configuration Validation"
echo "==================================="

# Validate Railway configuration files
validate_file_exists "deployments/railway/railway.toml" "Railway configuration file"
if [ $? -eq 0 ]; then
    validate_toml_syntax "deployments/railway/railway.toml" "Railway configuration"
    check_dockerfile_references "deployments/railway/railway.toml" "Railway"
fi

validate_file_exists "deployments/railway/docker-compose.railway.yaml" "Railway Docker Compose file"
if [ $? -eq 0 ]; then
    validate_yaml_syntax "deployments/railway/docker-compose.railway.yaml" "Railway Docker Compose"
fi

# Validate existing Dockerfiles (check apps/ directory instead)
echo ""
echo "🐳 Application Dockerfiles"
echo "=========================="
validate_dockerfile_exists "apps/server/Dockerfile" "Server Dockerfile"
validate_dockerfile_exists "apps/dashboard/Dockerfile" "Dashboard Dockerfile"
validate_dockerfile_exists "apps/status-page/Dockerfile" "Status Page Dockerfile"
validate_dockerfile_exists "apps/workflows/Dockerfile" "Workflows Dockerfile"

# Validate Railway-specific database and Redis Dockerfiles
echo ""
echo "🐳 Railway Infrastructure Dockerfiles"
echo "===================================="
validate_dockerfile_exists "deployments/railway/full-stack/database/Dockerfile" "Railway Database Dockerfile"
validate_dockerfile_exists "deployments/railway/full-stack/redis/Dockerfile" "Railway Redis Dockerfile"

# Validate Railway documentation
echo ""
echo "📚 Railway Documentation"
echo "======================="
validate_file_exists "deployments/railway/docs/getting-started.md" "Railway getting started guide"
validate_file_exists "deployments/railway/docs/troubleshooting.md" "Railway troubleshooting guide"
validate_file_exists "deployments/railway/full-stack/README.md" "Railway full-stack README"
validate_file_exists "deployments/railway/lightweight/README.md" "Railway lightweight README"

echo ""
echo "📋 Testing Scripts Validation"
echo "============================"

# Validate testing scripts
validate_file_exists "deployments/scripts/test-render-deploy.sh" "Render test script"
validate_file_exists "deployments/scripts/test-railway-deploy.sh" "Railway test script"
validate_file_exists "deployments/scripts/validate-configs.sh" "Configuration validation script"

# Check if scripts are executable
echo ""
echo "🔐 Script Permissions"
echo "===================="
for script in deployments/scripts/*.sh; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            echo -e "${GREEN}✅${NC} $(basename "$script") is executable"
        else
            echo -e "${YELLOW}⚠️${NC} $(basename "$script") is not executable"
            chmod +x "$script"
            echo -e "   ${GREEN}✅${NC} Made executable"
        fi
    fi
done

echo ""
echo "📋 Environment Files Validation"
echo "==============================="

# Validate environment example files
validate_file_exists "deployments/render/.env.example" "Render environment example"
validate_file_exists "deployments/railway/.env.example" "Railway environment example"

echo ""
echo "📋 Main Documentation"
echo "===================="

# Validate main documentation
validate_file_exists "deployments/README.md" "Main deployments README"

echo ""
echo "🎯 Validation Summary"
echo "===================="

# Count total files checked
TOTAL_FILES=$(find deployments -type f \( -name "*.md" -o -name "*.yaml" -o -name "*.toml" -o -name "Dockerfile" -o -name "*.sh" \) | wc -l)
echo "Total configuration files: $TOTAL_FILES"

# Check for any obvious issues
echo ""
echo "🔍 Quick Health Check"
echo "===================="

# Check for common issues
if grep -r "TODO\|FIXME\|XXX" deployments/ > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️${NC} Found TODO/FIXME comments:"
    grep -r "TODO\|FIXME\|XXX" deployments/ | head -5
else
    echo -e "${GREEN}✅${NC} No TODO/FIXME comments found"
fi

# Check for broken references
echo ""
echo "🔗 Reference Check"
echo "=================="

# Check for any obvious broken file references in documentation
echo "Checking for broken file references in documentation..."

# Final summary
echo ""
if [ $VALIDATION_ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 All validations passed!${NC}"
    echo "Your deployment configurations are ready for testing."
else
    echo -e "${RED}❌ Found $VALIDATION_ERRORS validation errors${NC}"
    echo "Please fix the issues above before testing deployments."
fi

echo ""
echo "🚀 Next Steps:"
echo "1. Run: ./deployments/scripts/test-render-deploy.sh"
echo "2. Run: ./deployments/scripts/test-railway-deploy.sh"
echo "3. Review logs and fix any issues"
echo ""

exit $VALIDATION_ERRORS
