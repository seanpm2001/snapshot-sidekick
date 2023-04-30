import express from 'express';
import { voteReportWithStorage, rpcError, rpcSuccess } from './helpers/utils';
import log from './helpers/log';
import { queues } from './lib/queue';
import getModerationList from './lib/moderationList';

const router = express.Router();

router.post('/votes/generate', async (req, res) => {
  log.info(`[http] POST /votes/generate`);

  const body = req.body || {};
  const event = body.event.toString();
  const id = body.id.toString().replace('proposal/', '');

  if (req.headers['authenticate'] !== process.env.WEBHOOK_AUTH_TOKEN?.toString()) {
    return rpcError(res, 'UNAUTHORIZE', id);
  }

  if (!event || !id) {
    return rpcError(res, 'Invalid Request', id);
  }

  if (event !== 'proposal/end') {
    return rpcSuccess(res, 'Event skipped', id);
  }

  try {
    await voteReportWithStorage(id).canBeCached();
    queues.add(id);
    return rpcSuccess(res, 'Cache file generation queued', id);
  } catch (e) {
    log.error(e);
    return rpcError(res, 'INTERNAL_ERROR', id);
  }
});

router.post('/votes/:id', async (req, res) => {
  const { id } = req.params;
  log.info(`[http] POST /votes/${id}`);

  const votesReport = voteReportWithStorage(id);

  try {
    const file = await votesReport.cachedFile();

    if (typeof file === 'string') {
      res.header('Content-Type', 'text/csv');
      res.attachment(votesReport.filename);
      return res.send(Buffer.from(file));
    }

    votesReport
      .canBeCached()
      .then(() => {
        queues.add(id);
        return rpcError(res, 'PENDING_GENERATION', id);
      })
      .catch((e: any) => {
        log.error(e);
        rpcError(res, e, id);
      });
  } catch (e) {
    log.error(e);
    return rpcError(res, 'INTERNAL_ERROR', id);
  }
});

router.get('/moderationList', async (req, res) => {
  const { fields } = req.query;

  try {
    res.send(getModerationList(fields ? (fields as string).split(',') : undefined));
  } catch (e) {
    log.error(e);
    return rpcError(res, 'INTERNAL_ERROR', '');
  }
});

export default router;
