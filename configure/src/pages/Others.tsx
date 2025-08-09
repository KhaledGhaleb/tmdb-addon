import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useConfig } from '@/contexts/use-config';
import { AgeRatingSelect } from '@/components/AgeRatingSelect';
import { SearchToggle } from '@/components/SearchToggle';

const Others = () => {
  const { hideEpisodeThumbnails, setHideEpisodeThumbnails } = useConfig();
  const { includeAdult, setIncludeAdult } = useConfig();
  const { provideImdbId, setProvideImdbId } = useConfig();
  const { tmdbPrefix, setTmdbPrefix } = useConfig();
  const { hideInCinemaTag, setHideInCinemaTag } = useConfig();
  const { castCount, setCastCount } = useConfig();
  const { numYears, setNumYears } = useConfig();
  const { minVotesMovies, setMinVotesMovies } = useConfig();
  const { minVotesTV, setMinVotesTV } = useConfig();

  return (
    <main className="md:p-12 px-2 py-12">
      <div className="flex flex-col mb-6">
        <h1 className="text-xl font-semibold mb-1">Addon Settings</h1>
        <p className="text-gray-500 text-sm">
          Customize the addon settings to suit your needs.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SearchToggle />
        <Card className="flex flex-row items-center justify-between p-6">
          <div className="space-y-0.5">
            <h1 className="text-sm font-semibold mb-1">Enable adult content</h1>
            <p className="text-gray-500 text-sm">
              Include adult content in search results
            </p>
          </div>
          <Switch checked={includeAdult} onCheckedChange={setIncludeAdult} />
        </Card>
        <Card className="flex flex-row items-center justify-between p-6">
          <div className="space-y-0.5">
            <label className="text-sm font-semibold mb-1">
              Hide Episode Thumbnails
            </label>
            <p className="text-gray-500 text-sm">
              Avoid spoilers by hiding episode preview images
            </p>
          </div>
          <Switch
            checked={hideEpisodeThumbnails}
            onCheckedChange={setHideEpisodeThumbnails}
          />
        </Card>
        <Card className="flex flex-row items-center justify-between p-4 sm:p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="space-y-0.5">
            <h1 className="text-sm font-semibold mb-1">
              Provide IMDB metadata
            </h1>
            <p className="text-gray-500 text-sm">
              Include IMDB IDs in metadata for better integration with other
              addons.
            </p>
          </div>
          <Switch
            checked={provideImdbId}
            onCheckedChange={() => setProvideImdbId(!provideImdbId)}
          />
        </Card>
        <Card className="flex flex-row items-center justify-between p-4 sm:p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="space-y-0.5">
            <h1 className="text-sm font-semibold mb-1">Use TMDB prefix</h1>
            <p className="text-gray-500 text-sm">
              Add "TMDB -" prefix to all catalog names for better organization.
            </p>
          </div>
          <Switch
            checked={tmdbPrefix}
            onCheckedChange={() => setTmdbPrefix(!tmdbPrefix)}
          />
        </Card>
        <Card className="flex flex-row items-center justify-between p-6">
          <div className="space-y-0.5">
            <h1 className="text-sm font-semibold mb-1">Hide 'In Cinema' tag</h1>
            <p className="text-gray-500 text-sm">
              Hide the 'In Cinema' tag from posters
            </p>
          </div>
          <Switch
            checked={hideInCinemaTag}
            onCheckedChange={setHideInCinemaTag}
          />
        </Card>
        <Card className="flex flex-row items-center justify-between p-6">
          <div className="space-y-0.5">
            <h1 className="text-sm font-semibold mb-1">Cast count to show</h1>
            <p className="text-gray-500 text-sm">
              Number of cast members to display (minimum 5, maximum 15, or
              Unlimited)
            </p>
          </div>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={castCount === undefined ? 'Unlimited' : castCount}
            onChange={(e) => {
              const value = e.target.value;
              setCastCount(value === 'Unlimited' ? undefined : Number(value));
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value="Unlimited">Unlimited</option>
          </select>
        </Card>
        <Card className="flex flex-row items-center justify-between p-6">
          <div className="space-y-0.5">
            <h1 className="text-sm font-semibold mb-1">Number of Years</h1>
            <p className="text-gray-500 text-sm">
              Select the number of years (between 1 and 120)
            </p>
          </div>

          <div className="flex flex-col items-end">
            <input
              type="range"
              min={1}
              max={120}
              value={numYears}
              onChange={(e) => setNumYears(Number(e.target.value))}
              className="w-40"
            />
            <span className="text-sm text-gray-700 mt-1">{numYears} years</span>
          </div>
        </Card>
        <Card className="flex flex-row items-center justify-between p-6">
          <div className="space-y-0.5">
            <h1 className="text-sm font-semibold mb-1">Number of Years</h1>
            <p className="text-gray-500 text-sm">
              Select the Min Votes per Movie (between 0 and 10000)
            </p>
          </div>

          <div className="flex flex-col items-end">
            <input
              type="range"
              min={0}
              max={10000}
              value={minVotesMovies}
              onChange={(e) => setMinVotesMovies(Number(e.target.value))}
              className="w-40"
            />
            <span className="text-sm text-gray-700 mt-1">
              {minVotesMovies} votes
            </span>
          </div>
        </Card>
        <Card className="flex flex-row items-center justify-between p-6">
          <div className="space-y-0.5">
            <h1 className="text-sm font-semibold mb-1">Number of Years</h1>
            <p className="text-gray-500 text-sm">
              Select the Min Votes per TV series (between 0 and 10000)
            </p>
          </div>

          <div className="flex flex-col items-end">
            <input
              type="range"
              min={0}
              max={10000}
              value={minVotesTV}
              onChange={(e) => setMinVotesTV(Number(e.target.value))}
              className="w-40"
            />
            <span className="text-sm text-gray-700 mt-1">
              {minVotesTV} votes
            </span>
          </div>
        </Card>
        <Card className="p-6">
          <AgeRatingSelect />
        </Card>
      </div>
    </main>
  );
};

export default Others;
