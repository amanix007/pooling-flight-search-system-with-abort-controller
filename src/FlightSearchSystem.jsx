import React, { useState, useEffect, useRef, useCallback } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Search, Filter, Plane, Clock, MapPin, DollarSign } from 'lucide-react';

// Mock API functions - replace with your actual Axios calls
const mockAPI = {
  // GET request for initialize
  initialize: async (query) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    // In real implementation: const response = await axios.get('/initialize', { params: { query } });
    return { searchId: `search_${Date.now()}` };
  },
  
  // POST request for availableFlights
  availableFlights: async (searchId, params = {}) => {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    // In real implementation:
    // const response = await axios.post('/available-flights', {
    //   searchId,
    //   ...params
    // }, {
    //   signal: params.signal
    // });
    
    const page = params.page || 1;
    const limit = params.limit || 10;
    const totalFlights = 50;
    const currentProgress = Math.min(0.1 + (page * 0.15), 1);
    
    const flights = Array.from({ length: Math.min(limit, totalFlights - (page - 1) * limit) }, (_, i) => ({
      id: `flight_${searchId}_${page}_${i}`,
      airline: ['American Airlines', 'Delta', 'United', 'Southwest'][Math.floor(Math.random() * 4)],
      departure: `${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      arrival: `${String(Math.floor(Math.random() * 12) + 13).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      price: Math.floor(Math.random() * 500) + 200,
      duration: `${Math.floor(Math.random() * 8) + 2}h ${Math.floor(Math.random() * 60)}m`,
      stops: Math.floor(Math.random() * 3)
    }));
    
    return {
      flights,
      searchProgress: currentProgress,
      hasMore: page * limit < totalFlights,
      total: totalFlights
    };
  }
};

const useFlightSearch = () => {
  const [searchId, setSearchId] = useState(null);
  const [flights, setFlights] = useState([]);
  const [searchProgress, setSearchProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    maxPrice: '',
    airline: '',
    maxStops: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  
  // Refs for managing polling and cancellation
  const abortControllerRef = useRef(null);
  const pollingTimeoutRef = useRef(null);
  const isPollingRef = useRef(false);
  const filtersRef = useRef(filters);
  const pageRef = useRef(currentPage);
  
  // Update refs when state changes
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  
  useEffect(() => {
    pageRef.current = currentPage;
  }, [currentPage]);
  
  // Cancel current request
  const cancelCurrentRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);
  
  // Polling function
  const pollFlights = useCallback(async (searchId, isInitialLoad = false) => {
    if (!searchId || isPollingRef.current) return;
    
    try {
      isPollingRef.current = true;
      
      // Cancel previous request
      cancelCurrentRequest();
      
      // Create new abort controller
      abortControllerRef.current = new AbortController();
      
      const requestPayload = {
        searchId,
        page: pageRef.current,
        limit: 10,
        ...filtersRef.current
      };
      
      const response = await mockAPI.availableFlights(searchId, { 
        ...requestPayload, 
        signal: abortControllerRef.current.signal 
      });
      
      // Check if request was cancelled
      if (abortControllerRef.current.signal.aborted) {
        return;
      }
      
      // Update state based on whether this is initial load or pagination
      if (isInitialLoad || pageRef.current === 1) {
        setFlights(response.flights);
      } else {
        setFlights(prev => [...prev, ...response.flights]);
      }
      
      setSearchProgress(response.searchProgress);
      setHasMore(response.hasMore);
      setError(null);
      
      // Continue polling if search is not complete
      if (response.searchProgress < 1) {
        pollingTimeoutRef.current = setTimeout(() => {
          pollFlights(searchId);
        }, 3000);
      }
      
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      isPollingRef.current = false;
      setLoading(false);
    }
  }, [cancelCurrentRequest]);
  
  // Initialize search
  const initializeSearch = useCallback(async (query) => {
    try {
      setLoading(true);
      setError(null);
      setFlights([]);
      setSearchProgress(0);
      setCurrentPage(1);
      setHasMore(true);
      
      const response = await mockAPI.initialize(query);
      setSearchId(response.searchId);
      
      // Start polling
      await pollFlights(response.searchId, true);
      
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [pollFlights]);
  
  // Handle filter changes
  const updateFilters = useCallback((newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
    setFlights([]);
    setHasMore(true);
    
    if (searchId) {
      pollFlights(searchId, true);
    }
  }, [searchId, pollFlights]);
  
  // Handle pagination (infinite scroll)
  const loadMore = useCallback(() => {
    if (!hasMore || loading || isPollingRef.current) return;
    
    setCurrentPage(prev => prev + 1);
    
    // Wait for page ref to update, then poll
    setTimeout(() => {
      if (searchId) {
        pollFlights(searchId);
      }
    }, 0);
  }, [hasMore, loading, searchId, pollFlights]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelCurrentRequest();
      isPollingRef.current = false;
    };
  }, [cancelCurrentRequest]);
  
  return {
    flights,
    searchProgress,
    loading,
    hasMore,
    error,
    filters,
    initializeSearch,
    updateFilters,
    loadMore
  };
};

const FlightCard = ({ flight }) => (
  <div className="bg-white rounded-lg shadow-md p-6 mb-4 border border-gray-200">
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center space-x-2">
        <Plane className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-800">{flight.airline}</h3>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold text-green-600">${flight.price}</div>
        <div className="text-sm text-gray-500">per person</div>
      </div>
    </div>
    
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div className="flex items-center space-x-2">
        <Clock className="w-4 h-4 text-gray-400" />
        <div>
          <div className="font-medium">{flight.departure}</div>
          <div className="text-sm text-gray-500">Departure</div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <MapPin className="w-4 h-4 text-gray-400" />
        <div>
          <div className="font-medium">{flight.duration}</div>
          <div className="text-sm text-gray-500">Duration</div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Clock className="w-4 h-4 text-gray-400" />
        <div>
          <div className="font-medium">{flight.arrival}</div>
          <div className="text-sm text-gray-500">Arrival</div>
        </div>
      </div>
    </div>
    
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">
        {flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
      </span>
      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
        Select Flight
      </button>
    </div>
  </div>
);

const FlightSearchSystem = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const {
    flights,
    searchProgress,
    loading,
    hasMore,
    error,
    filters,
    initializeSearch,
    updateFilters,
    loadMore
  } = useFlightSearch();
  
  const handleSearch = () => {
    if (searchQuery.trim()) {
      initializeSearch(searchQuery);
    }
  };
  
  const handleFilterChange = (key, value) => {
    updateFilters({
      ...filters,
      [key]: value
    });
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Flight Search</h1>
        
        {/* Search Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex space-x-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter destination (e.g., NYC to LAX)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center space-x-2"
            >
              <Search className="w-5 h-5" />
              <span>{loading ? 'Searching...' : 'Search'}</span>
            </button>
          </div>
        </div>
        
        {/* Search Progress */}
        {searchProgress > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Search Progress</span>
              <span className="text-sm text-gray-500">{Math.round(searchProgress * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${searchProgress * 100}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Filters */}
        {flights.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Filter className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Price</label>
                <input
                  type="number"
                  value={filters.maxPrice}
                  onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                  placeholder="Any price"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Airline</label>
                <select
                  value={filters.airline}
                  onChange={(e) => handleFilterChange('airline', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Any airline</option>
                  <option value="American Airlines">American Airlines</option>
                  <option value="Delta">Delta</option>
                  <option value="United">United</option>
                  <option value="Southwest">Southwest</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Stops</label>
                <select
                  value={filters.maxStops}
                  onChange={(e) => handleFilterChange('maxStops', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Any stops</option>
                  <option value="0">Direct only</option>
                  <option value="1">1 stop max</option>
                  <option value="2">2 stops max</option>
                </select>
              </div>
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p>Error: {error}</p>
          </div>
        )}
        
        {/* Flight Results */}
        {flights.length > 0 && (
          <div id="scrollableDiv" className="max-h-screen overflow-auto">
            <InfiniteScroll
              dataLength={flights.length}
              next={loadMore}
              hasMore={hasMore}
              loader={
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading more flights...</p>
                </div>
              }
              endMessage={
                <div className="text-center py-4">
                  <p className="text-gray-600">No more flights to load</p>
                </div>
              }
              scrollableTarget="scrollableDiv"
            >
              {flights.map((flight) => (
                <FlightCard key={flight.id} flight={flight} />
              ))}
            </InfiniteScroll>
          </div>
        )}
        
        {/* No Results */}
        {flights.length === 0 && !loading && searchProgress > 0 && (
          <div className="text-center py-12">
            <Plane className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No flights found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlightSearchSystem;