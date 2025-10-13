import {
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Entity
    ,OneToMany
} from "typeorm";
import { Session } from "./session.entity";
enum UserRoles {
    VIEWER = "viewer",
    CREATOR = "creator"
}

enum AuthProviders {
    GOOGLE = "google",
    APPLE = "apple",
    EMAIL = "email"
}

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid", name: "auth_id" })
    auth_id: string;

    @Column({ type: "text", unique: true, name: "username" })
    username: string;

    @Column({ type: "text", name: "full_name" })
    full_name: string;

    @Column({ type: "text", unique: true, name: "email" })
    email: string;

    @Column({ type: "text", name: "avatar_url", nullable: true, default: null })
    avatar_url?: string;

    @Column({ type: "text", name: "bio", nullable: true, default: null })
    bio?: string;

    @Column({
        type: "text",
        name: "role",
        enum: UserRoles,
        default: UserRoles.VIEWER
    })
    role: "viewer" | "creator";

    @Column({ type: "jsonb", default: {}, name: "preferences" })
    preferences: Record<string, any>;

    @Column({
        type: "text",
        enum: AuthProviders,
        name: "auth_provider",
        default: AuthProviders.EMAIL
    })
    auth_provider: "email" | "apple" | "google";

    @CreateDateColumn({ type: "timestamptz", name: "created_at" })
    created_at: Date;

    @CreateDateColumn({ type: "timestamptz", name: "updated_at" })
    updated_at: Date;

    @OneToMany(() => Session, session => session.user)
    sessions: Session[];
}
