/**
 * Authentication Middleware for Omni-Dromenon-Engine
 */

import { Request, Response, NextFunction } from 'express';
import { authConfig } from '../config.js';

// =============================================================================
// TYPES
// =============================================================================

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'audience' | 'performer' | 'admin';
    sessionId?: string;
  };
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Validate performer secret header.
 */
export function performerAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const secret = req.headers['x-performer-secret'] as string;
  
  if (!secret) {
    res.status(401).json({ error: 'Missing performer secret' });
    return;
  }
  
  if (secret !== authConfig.performerSecret) {
    res.status(403).json({ error: 'Invalid performer secret' });
    return;
  }
  
  req.user = {
    id: req.headers['x-performer-id'] as string || 'unknown',
    role: 'performer',
  };
  
  next();
}

/**
 * Validate admin secret header.
 */
export function adminAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const secret = req.headers['x-admin-secret'] as string;
  
  if (!secret) {
    res.status(401).json({ error: 'Missing admin secret' });
    return;
  }
  
  if (secret !== authConfig.adminSecret) {
    res.status(403).json({ error: 'Invalid admin secret' });
    return;
  }
  
  req.user = {
    id: 'admin',
    role: 'admin',
  };
  
  next();
}

/**
 * Optional auth - attach user if valid, continue otherwise.
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const performerSecret = req.headers['x-performer-secret'] as string;
  const adminSecret = req.headers['x-admin-secret'] as string;
  
  if (adminSecret === authConfig.adminSecret) {
    req.user = { id: 'admin', role: 'admin' };
  } else if (performerSecret === authConfig.performerSecret) {
    req.user = {
      id: req.headers['x-performer-id'] as string || 'unknown',
      role: 'performer',
    };
  } else {
    req.user = {
      id: req.headers['x-client-id'] as string || 'anonymous',
      role: 'audience',
    };
  }
  
  next();
}

/**
 * Require minimum role level.
 */
export function requireRole(...roles: ('audience' | 'performer' | 'admin')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role,
      });
      return;
    }
    
    next();
  };
}
