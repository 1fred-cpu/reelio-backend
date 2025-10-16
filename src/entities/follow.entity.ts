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

@Entity("follows")
@Unique(["follower_id", "following_id"])
export class Follow {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, user => user.following, { onDelete: "CASCADE" })
  follower: User;

  @Column()
  @Index()
  follower_id: string;

  @ManyToOne(() => User, user => user.followers, { onDelete: "CASCADE" })
  following: User;

  @Column()
  @Index()
  following_id: string;

  @CreateDateColumn()
  created_at: Date;
}