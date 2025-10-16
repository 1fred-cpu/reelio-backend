import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    JoinColumn,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    Unique,
    Index
} from "typeorm";
import { User } from "@entities/user.entity";
import { Content } from "@entities/content.entity";

@Entity("watch_historys")
@Unique(["user_id", "content_id"]) // One unique record per user-content pair
export class WatchHistory {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("uuid")
    user_id: string;

    @ManyToOne(() => User, user => user.watchHistories, { onDelete: "CASCADE" })
    user: User;

    @Column("uuid")
    content_id: string;

    @ManyToOne(() => Content, content => content.watchHistories, {
        onDelete: "CASCADE"
    })
    content: Content;

    @Column({ type: "int", default: 0 })
    progress_seconds: number; // how far the user has watched

    @Column({ type: "int", nullable: true })
    duration_seconds?: number; // optional, to calculate % watched

    @Column({ type: "boolean", default: false })
    completed: boolean;

    @Index()
    @Column({ type: "timestamptz", nullable: true })
    last_watched_at?: Date;

    @CreateDateColumn("timestamptz")
    created_at: Date;

    @UpdateDateColumn("timestamptz")
    updated_at: Date;
}
