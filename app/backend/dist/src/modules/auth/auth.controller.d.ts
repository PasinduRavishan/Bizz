import { AuthService } from './auth.service';
import { SignupDto, LoginDto } from './dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
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
    getProfile(req: any): any;
}
