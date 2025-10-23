#!/usr/bin/env node

import pkg from '@next/env';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const { loadEnvConfig } = pkg;

loadEnvConfig(process.cwd());

const { MONGODB_URI, MONGODB_DB_NAME } = process.env;

if (!MONGODB_URI) {
  console.error('A variável de ambiente MONGODB_URI não está definida.');
  process.exit(1);
}

const rl = readline.createInterface({ input, output });

async function ask(question) {
  const answer = await rl.question(question);
  return answer.trim();
}

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'super_admin'], default: 'admin' },
    approved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    approvedAt: { type: Date }
  },
  { timestamps: true }
);

const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);

(async () => {
  try {
    const email = await ask('Email: ');
    const name = await ask('Nome: ');
    const password = await ask('Senha: ');

    if (!email || !name || !password) {
      console.error('Email, nome e senha são obrigatórios.');
      process.exitCode = 1;
      return;
    }

    await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB_NAME || undefined
    });

    const existing = await Admin.findOne({ email }).lean();
    if (existing) {
      console.error('Já existe um usuário cadastrado com este email.');
      process.exitCode = 1;
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await Admin.create({
      name,
      email,
      password: hashedPassword,
      role: 'super_admin',
      approved: true,
      approvedAt: new Date()
    });

    console.log('Super admin criado com sucesso!');
  } catch (error) {
    console.error('Erro ao criar super admin:', error);
    process.exitCode = 1;
  } finally {
    rl.close();
    await mongoose.disconnect().catch(() => {});
  }
})();
