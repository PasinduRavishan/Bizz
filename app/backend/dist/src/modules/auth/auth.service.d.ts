import { JwtService } from '@nestjs/jwt';
import { SignupDto, LoginDto } from './dto';
export declare class AuthService {
    private jwtService;
    private prisma;
    constructor(jwtService: JwtService);
    signup(signupDto: SignupDto): Promise<{
        access_token: string;
        user: {
            email: string | null;
            name: string | null;
            role: import(".prisma/client").$Enums.Role;
            id: string;
            address: string | null;
            createdAt: Date;
        };
    }>;
    login(loginDto: LoginDto): Promise<{
        access_token: string;
        user: {
            id: string;
            email: string | null;
            name: string | null;
            role: import(".prisma/client").$Enums.Role;
            address: string | null;
            createdAt: Date;
        };
    }>;
    validateUser(userId: string): Promise<{
        email: string | null;
        name: string | null;
        role: import(".prisma/client").$Enums.Role;
        id: string;
        address: string | null;
        createdAt: Date;
    }>;
    onModuleDestroy(): Promise<void>;
}
