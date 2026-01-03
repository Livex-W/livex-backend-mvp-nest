 
import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
    private app: admin.app.App;

    constructor(private readonly configService: ConfigService) { }

    onModuleInit() {
        if (!admin.apps.length) {
            try {
                const credentialsPath = this.configService.get<string>('FIREBASE_CREDENTIALS_PATH');

                if (!credentialsPath) {
                    console.error('FIREBASE_CREDENTIALS_PATH not set in environment variables');
                    return;
                }


                this.app = admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: process.env.FIREBASE_PROJECT_ID || '',
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
                        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
                    }),
                });
                console.log('Firebase Admin initialized successfully');
            } catch (error) {
                console.error('Failed to initialize Firebase Admin:', error);
                throw new InternalServerErrorException('Firebase Admin initialization failed');
            }
        } else {
            this.app = admin.app();
        }
    }

    async verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
        if (!this.app) {
            throw new InternalServerErrorException('Firebase Admin not initialized - missing credentials?');
        }
        try {
            return await this.app.auth().verifyIdToken(token);
        } catch {
            throw new InternalServerErrorException('Invalid Firebase ID Token');
        }
    }

    async createUser(email: string, password?: string, displayName?: string): Promise<admin.auth.UserRecord> {
        if (!this.app) {
            throw new InternalServerErrorException('Firebase Admin not initialized');
        }
        try {
            return await this.app.auth().createUser({
                email,
                password,
                displayName,
            });
        } catch (error: any) {
             
            if (error.code === 'auth/email-already-exists') {
                // Try to get the user
                return this.app.auth().getUserByEmail(email);
            }
            throw error;
        }
    }
}
