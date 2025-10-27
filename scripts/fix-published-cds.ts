import mongoose from 'mongoose';
import CdModel from '@/lib/models/Cd';

interface CdRecord {
  _id: mongoose.Types.ObjectId;
  title?: string;
  status?: string;
  published_at?: Date | null;
  publishedAt?: Date | null;
}

async function fixPublishedCds() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI não configurado');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Conectado ao MongoDB');

    const publishedFilter = {
      $or: [{ published_at: { $ne: null } }, { publishedAt: { $ne: null } }]
    } as const;
    const statusMismatchFilter = {
      $or: [{ status: { $exists: false } }, { status: { $ne: 'published' } }]
    } as const;

    const cdsToFix = await CdModel.find({
      $and: [publishedFilter, statusMismatchFilter]
    })
      .select('title status published_at publishedAt')
      .lean<CdRecord[]>();

    console.log(`📋 Encontrados ${cdsToFix.length} CDs para corrigir`);

    if (!cdsToFix.length) {
      console.log('✅ Nenhum CD precisa ser corrigido!');
      return;
    }

    cdsToFix.forEach((cd, index) => {
      const publishedAt = cd.published_at ?? cd.publishedAt ?? null;
      console.log(`${index + 1}. ${cd.title ?? 'Sem título'}`);
      console.log(`   Status atual: ${cd.status ?? 'indefinido'}`);
      console.log(`   published_at: ${publishedAt?.toISOString?.() ?? 'null'}`);
    });

    let modifiedCount = 0;

    for (const cd of cdsToFix) {
      const publishedAtValue = cd.published_at ?? cd.publishedAt ?? null;
      const update: Record<string, unknown> = { status: 'published' };
      if (publishedAtValue) {
        update.publishedAt = publishedAtValue;
        update.published_at = publishedAtValue;
      }

      const result = await CdModel.updateOne({ _id: cd._id }, { $set: update });
      modifiedCount += result.modifiedCount ?? 0;
    }

    console.log(`\n✅ ${modifiedCount} CDs atualizados com sucesso!`);

    const totalPublished = await CdModel.countDocuments({
      status: 'published'
    });

    console.log(`\n📊 Total de CDs publicados agora: ${totalPublished}`);

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('👋 Desconectado do MongoDB');
    }
  }
}

void fixPublishedCds();
