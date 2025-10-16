import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  Index,
  Unique
} from "typeorm";
import { User } from "@entities/user.entity";
import { Content } from "@entities/content.entity";

@Entity("views")
@Unique(["user_id", "content_id"]) // Optional: ensures a user only contributes one unique view per content
export class View {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /* ===== RELATIONS ===== */

  // The user who viewed the content (nullable for guest views)
  @ManyToOne(() => User, user => user.views, { onDelete: "CASCADE", nullable: true })
  user?: User;

  @Column({ type: "uuid", nullable: true })
  @Index()
  user_id?: string;

  // The content being viewed
  @ManyToOne(() => Content, content => content.views, { onDelete: "CASCADE" })
  content: Content;

  @Column({ type: "uuid" })
  @Index()
  content_id: string;

  /* ===== ANALYTICS FIELDS ===== */

  // Optional: store IP or device info for analytics
  @Column({ type: "varchar", length: 255, nullable: true })
  ip_address?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  user_agent?: string;

  // Number of seconds the user watched before leaving (for engagement tracking)
  @Column({ type: "int", default: 0 })
  watch_duration_seconds: number;

  // Whether the view is a full view (e.g., watched more than 80%)
  @Column({ type: "boolean", default: false })
  completed: boolean;

  // When the view occurred
  @CreateDateColumn()
  created_at: Date;
}