import {
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Entity,
    OneToMany
} from "typeorm";
import { Session } from "./session.entity";
import { Content } from "./content.entity";
import { WatchHistory } from "./watch-history.entity";
import { Follow } from "./follow.entity";
import { Like } from "./like.entity";
import { View } from "./view.entity";

export enum UserRoles {
    VIEWER = "viewer",
    CREATOR = "creator",
    ADMIN = "admin"
}

export enum AuthProviders {
    GOOGLE = "google",
    APPLE = "apple",
    EMAIL = "email"
}

export enum AccountStatus {
    PENDING = "pending", // awaiting email verification
    ACTIVE = "active", // fully verified
    SUSPENDED = "suspended", // disabled by admin
    DELETED = "deleted", // soft-deleted
    DISABLED = "disabled" // soft-deleted
}

@Entity("users")
export class User {
    /* ============================================================
     * CORE FIELDS
     * ============================================================ */
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "text", name: "full_name" })
    full_name: string;

    @Column({ type: "text", unique: true, name: "email" })
    email: string;

    @Column({ type: "text", unique: true, name: "password" })
    password: string;

    @Column({ type: "text", name: "avatar_url", nullable: true, default: null })
    avatar_url?: string;

    @Column({ type: "text", name: "bio", nullable: true, default: null })
    bio?: string;

    @Column({
        type: "enum",
        enum: UserRoles,
        name: "role",
        default: UserRoles.VIEWER
    })
    role: UserRoles;

    @Column({
        type: "enum",
        enum: AuthProviders,
        name: "auth_provider",
        default: AuthProviders.EMAIL
    })
    auth_provider: AuthProviders;

    @Column({ type: "jsonb", default: {}, name: "preferences" })
    preferences: Record<string, any>;

    @Column({ type: "boolean", default: false })
    featured: boolean;

    /* ============================================================
     * ACCOUNT VERIFICATION + SECURITY
     * ============================================================ */
    @Column({ type: "boolean", name: "email_verified", default: false })
    email_verified: boolean; // Boolean flag for email verification status.

    @Column({
        type: "timestamptz",
        name: "email_confirmed_at",
        default: null,
        nullable: true
    })
    email_confirmed_at?: Date | null; // Date  for email confirmed at.

    @Column({
        type: "text",
        name: "email_verification_token",
        nullable: true,
        default: null
    })
    email_verification_token?: string | null; // Random token sent to user’s email for verification.

    @Column({
        type: "timestamptz",
        name: "email_verification_expires_at",
        nullable: true,
        default: null
    })
    email_verification_expires_at?: Date | null; // Expiration timestamp for verification token.

    @Column({
        type: "text",
        name: "password_reset_token",
        nullable: true,
        default: null
    })
    password_reset_token?: string; // Token for resetting password.

    @Column({
        type: "timestamptz",
        name: "password_reset_expires",
        nullable: true,
        default: null
    })
    password_reset_expires?: Date; // Expiration timestamp for password reset.

    @Column({
        type: "enum",
        enum: AccountStatus,
        default: AccountStatus.PENDING,
        name: "status"
    })
    status: AccountStatus; // Account lifecycle status (pending, active, suspended, etc.).

    @Column({ type: "boolean", name: "two_factor_enabled", default: false })
    two_factor_enabled: boolean; // Whether 2FA is enabled.

    @Column({ type: "text", name: "two_factor_secret", nullable: true })
    two_factor_secret?: string; // Secret used to generate/validate OTPs (TOTP).

    /* ============================================================
     * METADATA
     * ============================================================ */
    @CreateDateColumn({ type: "timestamptz", name: "created_at" })
    created_at: Date;

    @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
    updated_at: Date;

    // One user can  have multiple sessions
    @OneToMany(() => Session, session => session.user)
    sessions: Session[];

    // One user can have multiple contents
    @OneToMany(() => Content, content => content.creator)
    contents: Content[];

    // One user can have watch histories
    @OneToMany(() => WatchHistory, watchHistory => watchHistory.user)
    watchHistories: WatchHistory[];

    // One user have following users
    @OneToMany(() => Follow, follow => follow.follower)
    following: Follow[];

    // One user have many followers
    @OneToMany(() => Follow, follow => follow.following)
    followers: Follow[];

    @OneToMany(() => Like, like => like.user)
    likes: Like[];

    @OneToMany(() => View, view => view.user)
    views: View[];
}
