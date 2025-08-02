#!/bin/bash

# CartSaver Backend Deployment Script for RunPod
echo "🚀 Preparing CartSaver backend for RunPod deployment..."

# Create deployment package
echo "📦 Creating deployment package..."
zip -r backend-deploy.zip . -x 'node_modules/*' '.git/*' '*.log' '.env*' '.DS_Store'

echo "✅ Deployment package created: backend-deploy.zip"
echo ""
echo "📋 Next steps:"
echo "1. Upload backend-deploy.zip to your RunPod container"
echo "2. In RunPod terminal, run:"
echo "   unzip backend-deploy.zip"
echo "   docker build -t cartsaver-backend ."
echo "   docker run -d -p 3000:8080 --name cartsaver-api cartsaver-backend"
echo "3. Configure networking in RunPod dashboard"
echo "4. Set environment variables in RunPod"
echo ""
echo "🔗 Your backend will be available at:"
echo "   http://<your-runpod-id>-3000.proxy.runpod.net" 