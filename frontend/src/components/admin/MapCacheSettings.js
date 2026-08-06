/**
 * MapCacheSettings - Admin component for managing offline map tiles
 * AirYatra Aviation Platform
 */

import React, { useState } from 'react';
import { 
  Map, Download, Trash2, RefreshCw, Wifi, WifiOff, 
  HardDrive, CheckCircle, AlertTriangle, Loader2,
  MapPin, Plane
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import useMapCache, { INDIA_REGIONS } from '@/hooks/useMapCache';

const MapCacheSettings = () => {
  const {
    stats,
    loading,
    error,
    preCaching,
    preCacheProgress,
    getStats,
    clearCache,
    preCacheRegion,
    preCacheMultipleRegions,
    isSupported
  } = useMapCache();

  const [selectedRegions, setSelectedRegions] = useState(['mumbai', 'delhi', 'bangalore']);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Listen to online/offline events
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleClearCache = async () => {
    if (window.confirm('Clear all cached map tiles? / सभी कैश्ड मैप टाइल्स हटाएं?')) {
      const result = await clearCache();
      if (result) {
        toast.success('Map cache cleared! / मैप कैश क्लियर!');
      } else {
        toast.error('Failed to clear cache');
      }
    }
  };

  const handlePreCacheSelected = async () => {
    if (selectedRegions.length === 0) {
      toast.error('Select at least one region / कम से कम एक क्षेत्र चुनें');
      return;
    }
    
    toast.info(`Caching ${selectedRegions.length} regions... / ${selectedRegions.length} क्षेत्र कैश हो रहे हैं...`);
    const result = await preCacheMultipleRegions(selectedRegions);
    if (result) {
      toast.success(`Cached ${result.totalCached} tiles! / ${result.totalCached} टाइल्स कैश!`);
    }
  };

  const handlePreCacheAll = async () => {
    toast.info('Caching all major Indian cities... / सभी प्रमुख शहर कैश हो रहे हैं...');
    const allRegions = Object.keys(INDIA_REGIONS).filter(k => k !== 'all_india');
    const result = await preCacheMultipleRegions(allRegions, [8, 10]);
    if (result) {
      toast.success(`Cached ${result.totalCached} tiles for all cities!`);
    }
  };

  const toggleRegion = (regionKey) => {
    setSelectedRegions(prev => 
      prev.includes(regionKey) 
        ? prev.filter(r => r !== regionKey)
        : [...prev, regionKey]
    );
  };

  if (!isSupported()) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-3" />
          <p className="text-white">Service Worker not supported</p>
          <p className="text-slate-400 text-sm">Offline maps require a modern browser</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Map className="h-5 w-5 text-blue-500" />
                Offline Map Cache / ऑफलाइन मैप कैश
              </CardTitle>
              <CardDescription className="text-slate-400">
                Cache map tiles for helicopter tracking in low-connectivity areas
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                  <Wifi className="h-3 w-3 mr-1" /> Online
                </Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
                  <WifiOff className="h-3 w-3 mr-1" /> Offline
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Cache Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-slate-800 rounded-lg text-center">
              <HardDrive className="h-6 w-6 mx-auto text-blue-400 mb-2" />
              <div className="text-2xl font-bold text-white">
                {stats?.tileCount?.toLocaleString() || 0}
              </div>
              <div className="text-slate-400 text-sm">Tiles Cached</div>
            </div>
            <div className="p-4 bg-slate-800 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-400">
                {stats?.estimatedSizeMB || 0} MB
              </div>
              <div className="text-slate-400 text-sm">Cache Size</div>
            </div>
            <div className="p-4 bg-slate-800 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-400">
                {stats?.maxTiles?.toLocaleString() || 2000}
              </div>
              <div className="text-slate-400 text-sm">Max Tiles</div>
            </div>
            <div className="p-4 bg-slate-800 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-400">
                ~{stats?.maxSizeMB || 50} MB
              </div>
              <div className="text-slate-400 text-sm">Max Size</div>
            </div>
          </div>

          {/* Progress Bar */}
          {stats && (
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Cache Usage</span>
                <span className="text-white">
                  {((stats.tileCount / stats.maxTiles) * 100).toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={(stats.tileCount / stats.maxTiles) * 100} 
                className="h-2 bg-slate-700"
              />
            </div>
          )}

          {/* Pre-Cache Progress */}
          {preCaching && preCacheProgress && (
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Caching {preCacheProgress.region}...</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              onClick={getStats} 
              variant="outline" 
              disabled={loading}
              className="flex-1"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh Stats
            </Button>
            <Button 
              onClick={handleClearCache} 
              variant="destructive"
              disabled={loading || preCaching}
              className="flex-1"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Cache
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Region Selection */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <MapPin className="h-5 w-5 text-orange-500" />
            Pre-Cache Regions / क्षेत्र प्री-कैश करें
          </CardTitle>
          <CardDescription className="text-slate-400">
            Download map tiles for specific regions to use offline
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Major Cities */}
          <div className="mb-4">
            <h4 className="text-white font-medium mb-2">Major Cities / प्रमुख शहर</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {['mumbai', 'delhi', 'bangalore', 'chennai', 'hyderabad', 'kolkata', 'pune', 'ahmedabad', 'jaipur', 'goa'].map(regionKey => (
                <label 
                  key={regionKey}
                  className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedRegions.includes(regionKey) 
                      ? 'bg-blue-500/20 border border-blue-500/50' 
                      : 'bg-slate-800 border border-transparent hover:border-slate-600'
                  }`}
                >
                  <Switch
                    checked={selectedRegions.includes(regionKey)}
                    onCheckedChange={() => toggleRegion(regionKey)}
                  />
                  <span className="text-white text-sm">{INDIA_REGIONS[regionKey].name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Pilgrimage Routes */}
          <div className="mb-4">
            <h4 className="text-white font-medium mb-2 flex items-center gap-2">
              <Plane className="h-4 w-4 text-orange-400" />
              Pilgrimage Routes / तीर्थ मार्ग
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {['shirdi', 'tirupati', 'vaishno_devi', 'kedarnath'].map(regionKey => (
                <label 
                  key={regionKey}
                  className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedRegions.includes(regionKey) 
                      ? 'bg-orange-500/20 border border-orange-500/50' 
                      : 'bg-slate-800 border border-transparent hover:border-slate-600'
                  }`}
                >
                  <Switch
                    checked={selectedRegions.includes(regionKey)}
                    onCheckedChange={() => toggleRegion(regionKey)}
                  />
                  <span className="text-white text-sm">{INDIA_REGIONS[regionKey].name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Download Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={handlePreCacheSelected}
              disabled={preCaching || selectedRegions.length === 0}
              className="flex-1 bg-blue-500 hover:bg-blue-600"
            >
              {preCaching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Cache Selected ({selectedRegions.length})
            </Button>
            <Button 
              onClick={handlePreCacheAll}
              disabled={preCaching}
              variant="outline"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Cache All India
            </Button>
          </div>

          {/* Info Box */}
          <div className="mt-4 p-3 bg-slate-800 rounded-lg text-sm">
            <p className="text-slate-400">
              ℹ️ <strong className="text-white">How it works:</strong> Map tiles are cached in your browser. 
              When offline, helicopter tracking will use cached tiles instead of downloading new ones.
            </p>
            <p className="text-slate-400 mt-1">
              Each city caches ~100-200 tiles at zoom levels 8, 10, 12 (overview to street level).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Offline Indicator Preview */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isOnline ? (
                <>
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400">Maps loading from internet</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-orange-500 rounded-full" />
                  <span className="text-orange-400">Using cached map tiles (offline mode)</span>
                </>
              )}
            </div>
            {stats?.tileCount > 0 && (
              <Badge className="bg-green-500/20 text-green-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                {stats.tileCount} tiles ready
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MapCacheSettings;
