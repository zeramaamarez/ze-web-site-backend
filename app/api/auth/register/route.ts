import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import AdminModel from '@/lib/models/Admin';
import { registerSchema } from '@/lib/validations/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    await connectMongo();
    const exists = await AdminModel.findOne({ email });
    if (exists) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const admin = await AdminModel.create({ name, email, password: hashed });

    return NextResponse.json(
      {
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Register error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
