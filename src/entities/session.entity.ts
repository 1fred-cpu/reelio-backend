import {
    PrimaryGeneratedColumn,
    Column,
    Entity,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn
} from "typeorm";
import { User } from "./user.entity";

@Entity("sessions")
export class Session {
    @PrimaryGeneratedColumn({ type: "uuid", name: "id" })
    id: string;

    @Column({ type: "uuid", name: "user_id" })
    user_id: string;

    @ManyToOne(() => User, user => user.sessions)
    @JoinColumn({ name: "user_id", referencedColumnName: "id" })
    user: User;

    @Column({ type: "text", name: "access_token" })
    access_token: string;

    @Column({ type: "text", name: "referesh_token" })
    referesh_token: string;

    @Column({ type: "timestampz", name: "expires_at" })
    expires_at: Date;

    @Column({ type: "text", name: "ip_address" })
    ip_address: string;

    @Column({ type: "text", name: "user_agent" })
    user_agent: string;

    @Column({ type: "boolean", name: "is_active", default: true })
    is_active: boolean;

    @CreateDateColumn({ type: "timestampz", name: "created_at" })
    created_at: Date;

    @UpdateDateColumn({ type: "timestampz", name: "updated_at" })
    updated_at: Date;
}
