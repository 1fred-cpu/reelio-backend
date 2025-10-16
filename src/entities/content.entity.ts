import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    Index
} from "typeorm";
import { User } from "@entities/user.entity";
import { WatchHistory } from "@entities/watch-history.entity";
import { Like } from "./like.entity";
import { View } from "./view.entity";

export enum ContentType {
    SHORT_FILM = "short_film",
    FEATURE_FILM = "feature_film",
    DOCUMENTARY = "documentary",
    SERIES = "series",
    CLIP = "clip",
    OTHER = "other"
}

export enum ContentStatus {
    DRAFT = "draft",
    PUBLISHED = "published",
    PRIVATE = "private",
    ARCHIVED = "archived"
}

@Entity("contents")
export class Content {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 255 })
    title: string;

    @Column({ type: "text", nullable: true })
    description?: string;

    @Column({ type: "enum", enum: ContentType, default: ContentType.OTHER })
    type: ContentType;

    @Column({ type: "enum", enum: ContentStatus, default: ContentStatus.DRAFT })
    status: ContentStatus;

    @Column({ type: "varchar", nullable: true })
    thumbnail_url?: string;

    @Column({ type: "varchar", nullable: true })
    video_url?: string;

    @Column({ type: "varchar", nullable: true })
    trailer_url?: string;

    @Column({ type: "int", default: 0 })
    duration_seconds: number;

    @Column("uuid")
    creator_id: string;

    @ManyToOne(() => User, user => user.contents, { onDelete: "CASCADE" })
    creator: User;

    @Index()
    @Column({ type: "int", default: 0 })
    views_count: number;

    @Index()
    @Column({ type: "int", default: 0 })
    likes_count: number;

    @Column({ type: "boolean", default: false })
    featured: boolean;

    @Column({ type: "timestamp", nullable: true })
    featured_at?: Date;

    @Column({ type: "varchar", array: true, default: "{}" })
    tags: string[];

    @Column({ type: "jsonb", nullable: true })
    metadata?: Record<string, any>; // Resolution, genre, rating, etc.

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    // Optional relations
    @OneToMany(() => WatchHistory, history => history.content)
    watchHistories: WatchHistory[];

    @OneToMany(() => Like, like => like.content)
    likes: Like[];

    @OneToMany(() => View, view => view.content)
    views: View[];
}
