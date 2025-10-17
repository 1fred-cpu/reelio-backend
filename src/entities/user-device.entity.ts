import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { User } from "./user.entity";

@Entity("user_devices")
export class UserDevice {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => User, user => user.devices, { onDelete: "CASCADE" })
    user: User;

    @Column({ unique: true })
    device_token: string;

    @Column({ nullable: true })
    device_type?: string; // e.g., 'android', 'ios'

    @Column({ nullable: true })
    app_version?: string;

    @Column({ default: true })
    active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
