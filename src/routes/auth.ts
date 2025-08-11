import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { supabase } from '../config/supabase';
import { authenticateUser } from '../middleware/auth';
import { AuthRequest } from '../types';
import { csrfProtection } from '../middleware/csrf';
import { sanitizeInput, sanitizeOutput, sanitizeErrorMessage } from '../utils/security';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET!;

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', profile.id)
      .single();

    if (existingUser) {
      return done(null, existingUser);
    }

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        google_id: profile.id,
        email: profile.emails?.[0]?.value,
        name: profile.displayName
      }])
      .select()
      .single();

    if (error) throw error;
    done(null, newUser);
  } catch (error) {
    done(error, false);
  }
}));

// Sign up
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedName = sanitizeInput(name);

    if (!sanitizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { data, error } = await supabase.auth.signUp({
      email: sanitizedEmail,
      password,
      options: {
        data: {
          name: sanitizedName || null
        }
      }
    });

    if (error) {
      return res.status(400).json({ error: sanitizeErrorMessage(error) });
    }

    if (!data.user) {
      return res.status(400).json({ error: 'Failed to create user' });
    }

    const token = jwt.sign({ userId: data.user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ 
      token, 
      user: { 
        id: data.user.id, 
        email: sanitizeOutput(data.user.email), 
        name: sanitizeOutput(data.user.user_metadata?.name) 
      } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Sign in
router.post('/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const sanitizedEmail = sanitizeInput(email);

    if (!sanitizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password
    });

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: data.user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: data.user.id, 
        email: sanitizeOutput(data.user.email), 
        name: sanitizeOutput(data.user.user_metadata?.name) 
      } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  async (req: Request, res: Response) => {
    const user = req.user as any;
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const allowedUrls = ['http://localhost:3000', 'https://your-frontend-domain.com'];
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    
    if (!allowedUrls.includes(clientUrl)) {
      return res.status(400).json({ error: 'Invalid redirect URL' });
    }
    
    const sanitizedClientUrl = sanitizeOutput(clientUrl);
    res.redirect(`${sanitizedClientUrl}/auth/success?token=${encodeURIComponent(token)}`);
  }
);

// Logout
router.post('/logout', authenticateUser, (req: AuthRequest, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;