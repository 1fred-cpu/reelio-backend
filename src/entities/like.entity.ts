import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  Unique,
  Index
} from "typeorm";
import { User } from "@entities/user.entity";
import { Content } from "@entities/content.entity";

@Entity("likes")
@Unique(["user_id", "content_id"]) // Prevent duplicate likes
export class Like {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /* ===== RELATIONS ===== */
  @ManyToOne(() => User, user => user.likes, { onDelete: "CASCADE" })
  user: User;

  @Column()
  @Index()
  user_id: string;

  @ManyToOne(() => Content, content => content.likes, { onDelete: "CASCADE" })
  content: Content;

  @Column()
  @Index()
  content_id: string;

  /* ===== META ===== */
  @CreateDateColumn()
  created_at: Date;
}