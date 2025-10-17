import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn
} from "typeorm";
import { User } from "@entities/user.entity";

export enum NotificationType {
    LIKE = "LIKE",
    COMMENT = "COMMENT",
    FOLLOW = "FOLLOW",
    SYSTEM = "SYSTEM"
}

@Entity("notifications")
@Index(["receiver_id", "read"])
@Index(["receiver_id", "created_at"])
@Index(["type", "created_at"])
@Index(["read", "delivered"])
export class Notification {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    /** The user who receives the notification */
    @Column("uuid")
    receiver_id: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "receiver_id" })
    receiver: User;

    /** The user who triggered the action (e.g., liked, commented, followed) */
    @Column("uuid", { nullable: true })
    sender_id: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "sender_id" })
    sender: User | null;

    /** Notification category/type */
    @Column({ type: "enum", enum: NotificationType })
    type: NotificationType;

    /**  Short, readable title (e.g. "New like on your post") */
    @Column({ length: 150 })
    title: string;

    /**  Optional descriptive message */
    @Column({ type: "text", nullable: true })
    message?: string;

    /**  Extra data (e.g., contentId, commentId, etc.) */
    @Column({ type: "jsonb", nullable: true })
    data?: Record<string, any>;

    /** Whether the user has read the notification */
    @Column({ default: false })
    read: boolean;

    /**  Whether the push notification has been successfully delivered */
    @Column({ default: false })
    delivered: boolean;

    /** Timestamp when the user read it */
    @Column({ type: "timestamptz", nullable: true })
    read_at?: Date | null;

    /**  Timestamp when the notification was delivered */
    @Column({ type: "timestamptz", nullable: true })
    delivered_at?: Date | null;

    /** Record creation time */
    @CreateDateColumn({ type: "timestamptz" })
    created_at: Date;

    /**  Record update time */
    @UpdateDateColumn({ type: "timestamptz" })
    updated_at: Date;
}
