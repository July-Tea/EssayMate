import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity()
export class Config {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  @Index({ unique: true })
  model: string;

  @Column()
  apiKey: string;

  @Column({ type: 'json', nullable: true })
  modelConfigs: { [key: string]: any };

  @Column({ default: false })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'json', nullable: true })
  programState: any;

  constructor() {
    this.model = '';
    this.apiKey = '';
    this.modelConfigs = {};
    this.is_active = false;
    this.created_at = new Date();
    this.updated_at = new Date();
    this.programState = null;
  }
}