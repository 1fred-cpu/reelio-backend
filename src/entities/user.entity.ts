import {
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Entity,
} from 'typeorm';

enum UserRole {
  VIEWER = 'viewer',
  CREATOR = 'creator',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  auth_id: string;

  @Column({ type: 'text', unique: true, name: 'username' })
  username: string;

  @Column({ type: 'text', name: 'full_name' })
  full_name: string;

  @Column({ type: 'text', unique: true, name: 'email' })
  email: string;

  @Column({ type: 'text', name: 'avatar_url', nullable: true, default: null })
  avatar_url?: string;

  @Column({ type: 'text', name: 'bio', nullable: true, default: null })
  bio?: string;

  @Column({
    type: 'text',
    name: 'role',
    enum: UserRole,
    default: UserRole.VIEWER,
  })
  role: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
