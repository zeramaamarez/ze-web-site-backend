/**
 * Script manual para revisar e deletar arquivos marcados como "deleted" do Cloudinary
 * 
 * Como usar:
 * 1. npm run cleanup:cloudinary
 * 2. Revise a lista de arquivos
 * 3. Confirme a deleção
 */

import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import readline from 'readline';
import MediaModel from '@/lib/models/Media';
import UploadFileModel from '@/lib/models/UploadFile';

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Interface para prompt no terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI não configurado');
  
  await mongoose.connect(uri);
  console.log('✅ Conectado ao MongoDB');
}

async function listDeletedFiles(daysOld: number = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  // Buscar em Media
  const deletedMedia = await MediaModel.find({
    deleted: true,
    deletedAt: { $lt: cutoffDate }
  }).lean();
  
  // Buscar em UploadFile (arquivos antigos do Strapi)
  const deletedUploadFiles = await UploadFileModel.find({
    deleted: true,
    deletedAt: { $lt: cutoffDate }
  }).lean();
  
  return [...deletedMedia, ...deletedUploadFiles];
}

async function deleteFromCloudinary(cloudinaryId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(cloudinaryId);
    return result.result === 'ok' || result.result === 'not found';
  } catch (error) {
    console.error(`❌ Erro ao deletar ${cloudinaryId}:`, error);
    return false;
  }
}

async function main() {
  try {
    console.log('🧹 SCRIPT DE LIMPEZA DO CLOUDINARY\n');
    
    // Conectar ao banco
    await connectDB();
    
    // Perguntar quantos dias
    const daysInput = await prompt('Deletar arquivos marcados há quantos dias? (padrão: 7): ');
    const days = parseInt(daysInput) || 7;
    
    console.log(`\n📋 Buscando arquivos marcados há mais de ${days} dias...\n`);
    
    // Listar arquivos
    const files = await listDeletedFiles(days);
    
    if (files.length === 0) {
      console.log('✅ Nenhum arquivo encontrado para deletar!');
      rl.close();
      await mongoose.disconnect();
      return;
    }
    
    // Mostrar lista
    console.log(`📁 ${files.length} arquivos encontrados:\n`);
    
    let totalSize = 0;
    files.forEach((file, index) => {
      const size = file.size ? `${(file.size / 1024).toFixed(2)} KB` : 'tamanho desconhecido';
      const deletedDays = Math.floor((Date.now() - new Date(file.deletedAt).getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`${index + 1}. ${file.cloudinaryId || file.name}`);
      console.log(`   📦 Tamanho: ${size}`);
      console.log(`   🗓️  Deletado há: ${deletedDays} dias`);
      console.log(`   📌 Razão: ${file.deletionReason || 'não especificada'}`);
      console.log(`   🔗 Relacionado: ${file.relatedTo || 'N/A'}`);
      console.log('');
      
      if (file.size) totalSize += file.size;
    });
    
    console.log(`💾 Espaço total a liberar: ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`);
    
    // Confirmar deleção
    const confirm = await prompt('⚠️  DELETAR ESTES ARQUIVOS DO CLOUDINARY? (digite "SIM" para confirmar): ');
    
    if (confirm.toUpperCase() !== 'SIM') {
      console.log('❌ Operação cancelada.');
      rl.close();
      await mongoose.disconnect();
      return;
    }
    
    console.log('\n🗑️  Deletando arquivos...\n');
    
    // Deletar arquivos
    let successCount = 0;
    let failCount = 0;
    
    for (const file of files) {
      const cloudinaryId = file.cloudinaryId || file.hash;
      
      if (!cloudinaryId) {
        console.log(`⚠️  Pulando ${file._id}: cloudinaryId não encontrado`);
        failCount++;
        continue;
      }
      
      // Deletar do Cloudinary
      const deleted = await deleteFromCloudinary(cloudinaryId);
      
      if (deleted) {
        // Deletar do MongoDB
        if (file.resourceType) {
          await MediaModel.findByIdAndDelete(file._id);
        } else {
          await UploadFileModel.findByIdAndDelete(file._id);
        }
        
        console.log(`✅ Deletado: ${cloudinaryId}`);
        successCount++;
      } else {
        console.log(`❌ Falhou: ${cloudinaryId}`);
        failCount++;
      }
    }
    
    console.log('\n📊 RESUMO:');
    console.log(`✅ Sucesso: ${successCount}`);
    console.log(`❌ Falhas: ${failCount}`);
    console.log(`💾 Espaço liberado: ~${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('❌ Erro no script:', error);
  } finally {
    rl.close();
    await mongoose.disconnect();
    console.log('\n👋 Script finalizado.');
    process.exit(0);
  }
}

main();