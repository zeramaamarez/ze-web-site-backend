import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import AdminModel from '@/lib/models/Admin';
import PasswordResetTokenModel from '@/lib/models/PasswordResetToken';
import { resetPasswordSchema } from '@/lib/validations/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const { token, password } = parsed.data;

    await connectMongo();
    const resetToken = await PasswordResetTokenModel.findOne({ token });
    if (!resetToken) {
      return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 400 });
    }

    if (resetToken.expiresAt.getTime() < Date.now()) {
      await resetToken.deleteOne();
      return NextResponse.json({ error: 'Token expirado' }, { status: 400 });
    }

    const admin = await AdminModel.findById(resetToken.adminId).select('+password');
    if (!admin) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    admin.password = await bcrypt.hash(password, 10);
    await admin.save();
    await resetToken.deleteOne();

    return NextResponse.json({ message: 'Senha atualizada' });
  } catch (error) {
    console.error('Reset password error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
