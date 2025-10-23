import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import AdminModel from '@/lib/models/Admin';
import PasswordResetTokenModel from '@/lib/models/PasswordResetToken';
import { forgotPasswordSchema } from '@/lib/validations/auth';

function getBaseUrl() {
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

async function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('Configuração SMTP ausente');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const { email } = parsed.data;

    await connectMongo();
    const admin = await AdminModel.findOne({ email });
    if (!admin) {
      return NextResponse.json({ message: 'Se o email existir, enviaremos instruções.' });
    }

    await PasswordResetTokenModel.deleteMany({ adminId: admin._id });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await PasswordResetTokenModel.create({ adminId: admin._id, token, expiresAt });

    try {
      const transporter = await getTransporter();
      const resetUrl = `${getBaseUrl()}/auth/forgot-password?token=${token}`;
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Recuperação de senha',
        html: `<p>Olá ${admin.name},</p><p>Acesse o link para redefinir sua senha:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
      });
    } catch (emailError) {
      console.error('Email error', emailError);
      return NextResponse.json({ error: 'Não foi possível enviar o email' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Email enviado' });
  } catch (error) {
    console.error('Forgot password error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
