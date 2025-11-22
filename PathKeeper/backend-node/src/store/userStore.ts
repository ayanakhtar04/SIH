import { prisma } from '../prisma/client';
import { User } from '../types';

export interface IUserStore {
  getByEmail(email: string): Promise<User | undefined>;
  list(opts?: { skip?: number; take?: number; search?: string; role?: string }): Promise<{ users: User[]; total: number }>;
  add(user: Omit<User, 'createdAt'>): Promise<User>;
  getById(id: string): Promise<User | undefined>;
  delete(id: string): Promise<void>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  updateRole(id: string, role: string): Promise<void>;
  updateProfile(id: string, data: { name?: string; email?: string }): Promise<User>;
}

class PrismaUserStore implements IUserStore {
  async getByEmail(email: string): Promise<User | undefined> {
    const u = await prisma.user.findUnique({ where: { email } });
    return u ? this.map(u) : undefined;
  }
  async list(opts: { skip?: number; take?: number; search?: string; role?: string } = {}): Promise<{ users: User[]; total: number }> {
    const { skip = 0, take = 50, search, role } = opts;
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (role) where.role = role;
    const [rows, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: 'asc' }, skip, take }),
      prisma.user.count({ where })
    ]);
    return { users: rows.map(this.map), total };
  }
  async add(user: Omit<User, 'createdAt'>): Promise<User> {
    const created = await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash: user.passwordHash
      }
    });
    return this.map(created);
  }
  async getById(id: string): Promise<User | undefined> {
    const u = await prisma.user.findUnique({ where: { id } });
    return u ? this.map(u) : undefined;
  }
  async delete(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { passwordHash } });
  }
  async updateRole(id: string, role: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { role } });
  }
  async updateProfile(id: string, data: { name?: string; email?: string }): Promise<User> {
    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.email !== undefined) patch.email = data.email;
    if (Object.keys(patch).length === 0) {
      // No-op: return current user
      const current = await prisma.user.findUnique({ where: { id } });
      if (!current) throw new Error('User not found');
      return this.map(current);
    }
    const updated = await prisma.user.update({ where: { id }, data: patch });
    return this.map(updated);
  }
  private map(db: any): User {
    return {
      id: db.id,
      email: db.email,
      name: db.name,
      role: db.role as User['role'],
      passwordHash: db.passwordHash,
      createdAt: db.createdAt
    };
  }
}

export const userStore: IUserStore = new PrismaUserStore();
