import { readFileSync } from 'fs';
import VotesReport from '../../../src/lib/votesReport';
import { storageEngine } from '../../../src/helpers/utils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockFetchProposal = jest.fn((id: string): any => {
  return [];
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockFetchAllVotes = jest.fn((id: string): any => {
  return [];
});
jest.mock('../../../src/helpers/snapshot', () => {
  const originalModule = jest.requireActual('../../../src/helpers/snapshot');

  return {
    __esModule: true,
    ...originalModule,
    fetchProposal: (id: string) => mockFetchProposal(id),
    fetchAllVotes: (id: string) => mockFetchAllVotes(id)
  };
});

describe('VotesReport', () => {
  const id = '0x1e5fdb5c87867a94c1c7f27025d62851ea47f6072f2296ca53a48fce1b87cdef';
  const weightedId = '0x79ae5f9eb3c710179cfbf706fa451459ddd18d4b0bce37c22aae601128efe927';
  const _storageEngine = storageEngine('test-cache');
  const space = { id: '', name: '', network: '', settings: '' };

  function fixtureFilePath(id: string) {
    return `${__dirname}/../../fixtures/snapshot-votes-report-${id}.csv`;
  }

  it.each([
    ['single', id],
    ['weighted', weightedId]
  ])('generates a %s choices votes report', async (type: string, pid: string) => {
    const report = new VotesReport(pid, _storageEngine);
    mockFetchProposal.mockResolvedValueOnce(
      JSON.parse(readFileSync(`${__dirname}/../../fixtures/hub-proposal-${pid}.json`, 'utf8'))
    );
    mockFetchAllVotes.mockResolvedValueOnce(
      JSON.parse(readFileSync(`${__dirname}/../../fixtures/hub-votes-${pid}.json`, 'utf8'))
    );

    const content = await report.getContent();

    expect(content).toEqual(readFileSync(fixtureFilePath(pid), 'utf8'));
    expect(mockFetchProposal).toHaveBeenCalled();
    expect(mockFetchAllVotes).toHaveBeenCalled();
  });

  describe('isCacheable()', () => {
    it('raises an error when the proposal does not exist', () => {
      const report = new VotesReport('test', _storageEngine);
      mockFetchProposal.mockResolvedValueOnce(null);

      expect(report.isCacheable()).rejects.toBe('ENTRY_NOT_FOUND');
      expect(mockFetchProposal).toHaveBeenCalled();
    });

    it('raises an error when the proposal is not closed', async () => {
      const report = new VotesReport(id, _storageEngine);
      mockFetchProposal.mockResolvedValueOnce({
        state: 'pending',
        id: '',
        title: '',
        votes: 0,
        author: '',
        choices: [],
        space
      });

      expect(report.isCacheable()).rejects.toBe('PROPOSAL_NOT_CLOSED');
      expect(mockFetchProposal).toHaveBeenCalled();
    });

    it('returns true when the proposal can be cached', async () => {
      const report = new VotesReport(id, _storageEngine);
      mockFetchProposal.mockResolvedValueOnce({
        state: 'closed',
        id: '',
        title: '',
        votes: 0,
        author: '',
        choices: [],
        space
      });

      expect(await report.isCacheable()).toBe(true);
      expect(mockFetchProposal).toHaveBeenCalled();
    });
  });
});
