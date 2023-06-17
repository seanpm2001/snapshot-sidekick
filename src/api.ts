import express from 'express';
import { rpcError, rpcSuccess, storageEngine } from './helpers/utils';
import getModerationList from './lib/moderationList';
import VotesReport from './lib/votesReport';
import { signSpaceOwner, signValidProposal } from './lib/nftClaimer';
import { queue, getProgress } from './lib/queue';

const router = express.Router();

router.post('/votes/:id', async (req, res) => {
  const { id } = req.params;
  const votesReport = new VotesReport(id, storageEngine(process.env.VOTE_REPORT_SUBDIR));

  try {
    const file = await votesReport.cachedFile();

    if (typeof file === 'string') {
      res.header('Content-Type', 'text/csv');
      res.attachment(votesReport.filename);
      return res.send(Buffer.from(file));
    }

    try {
      await votesReport.canBeCached();
      queue(id);
      return rpcSuccess(res.status(202), getProgress(id).toString(), id);
    } catch (e: any) {
      console.error(e);
      rpcError(res, e, id);
    }
  } catch (e) {
    console.error(e);
    return rpcError(res, 'INTERNAL_ERROR', id);
  }
});

router.get('/moderation', async (req, res) => {
  const { list } = req.query;

  try {
    res.json(await getModerationList(list ? (list as string).split(',') : undefined));
  } catch (e) {
    console.error(e);
    return rpcError(res, 'INTERNAL_ERROR', '');
  }
});

router.post('/nft-claimer/:type(space|proposal)/sign', async (req, res) => {
  try {
    const { address, id, salt } = req.body;
    switch (req.params.type) {
      case 'space':
        return res.json(await signSpaceOwner(address, id, salt));
      case 'proposal':
        return res.json(await signValidProposal(address, id, salt));
      default:
        throw new Error('Invalid Request');
    }
  } catch (e: any) {
    console.error(e);
    return rpcError(res, e, '');
  }
});

export default router;
