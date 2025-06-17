import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity()
export class GeneralSettings {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, comment: '设置键名' })
  @Index()
  key: string;

  @Column({ type: 'text', comment: '设置值' })
  value: string;

  @Column({ nullable: true, comment: '设置描述' })
  description?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  constructor() {
    this.key = '';
    this.value = '';
    this.created_at = new Date();
    this.updated_at = new Date();
  }
}
