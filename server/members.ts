import express, { type Response } from 'express';
import type { Db, Log } from './schema.ts';
import {
    createMemberService,
    type MemberProblem,
    type MemberResult,
    type AccessChanged
} from './services/members.ts';

export type { AccessChanged } from './services/members.ts';

const PATH = '/workspaces/:workspaceId/members';

function respondToProblem(res: Response, problem: MemberProblem) {
    switch (problem) {
        case 'NOT_FOUND':
            return res.status(404).json({ code: 'NOT_FOUND' });
        case 'FORBIDDEN':
            return res.status(403).json({ code: 'FORBIDDEN' });
        case 'PROTECTED_MEMBER':
            return res.status(403).json({ code: 'PROTECTED_MEMBER' });
        case 'INVALID_ROLE':
            return res.status(400).json({ code: 'INVALID_ROLE' });
    }
    const unexpected: never = problem;
    throw new Error(`Unhandled membership problem: ${unexpected}`);
}

function respondToChange(res: Response, result: MemberResult) {
    if (!result.ok) return respondToProblem(res, result.problem);
    return res.status(204).end();
}

/** HTTP inputs and responses; each service operation enforces its own permissions. */
export function createMembers(db: Db, changed: AccessChanged, log: Pick<Log, 'warn'>) {
    const service = createMemberService(db, changed, log);
    const router = express.Router();
    router.use(PATH, (_req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    });
    router.get(PATH, async (req, res) => {
        const result = await service.list({
            actorId: req.userId,
            workspaceId: req.params.workspaceId
        });
        if (!result.ok) return respondToProblem(res, result.problem);
        return res.json(result.members);
    });
    router.patch(`${PATH}/:userId`, async (req, res) => {
        const result = await service.setRole(
            {
                actorId: req.userId,
                workspaceId: req.params.workspaceId,
                userId: req.params.userId
            },
            req.body?.role
        );
        return respondToChange(res, result);
    });
    router.delete(`${PATH}/:userId`, async (req, res) => {
        const result = await service.remove({
            actorId: req.userId,
            workspaceId: req.params.workspaceId,
            userId: req.params.userId
        });
        return respondToChange(res, result);
    });
    return router;
}
