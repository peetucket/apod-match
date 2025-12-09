import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Rocket, Star, RefreshCw, Send, Sparkles, Lightbulb } from "lucide-react";

interface APODData {
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  date: string;
  media_type: string;
}

const getRandomDate = (): string => {
  const start = new Date("2018-01-01");
  const end = new Date();
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  const randomDate = new Date(randomTime);
  return randomDate.toISOString().split("T")[0];
};

// Common English stopwords (based on NLTK)
const STOPWORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
  'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
  'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
  'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
  'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
  'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now',
  'd', 'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', 'couldn', 'didn', 'doesn',
  'hadn', 'hasn', 'haven', 'isn', 'ma', 'mightn', 'mustn', 'needn', 'shan', 'shouldn',
  'wasn', 'weren', 'won', 'wouldn', 'also', 'could', 'would', 'might', 'must', 'shall',
  'may', 'upon', 'yet', 'though', 'although', 'however', 'therefore', 'hence', 'thus',
  'still', 'already', 'even', 'ever', 'never', 'always', 'often', 'sometimes', 'usually',
  'really', 'actually', 'certainly', 'probably', 'perhaps', 'maybe', 'likely', 'unlikely',
  'one', 'two', 'three', 'four', 'five', 'first', 'second', 'third', 'new', 'old',
  'many', 'much', 'little', 'less', 'least', 'last', 'next', 'another', 'either',
  'neither', 'every', 'everything', 'everyone', 'everywhere', 'something', 'someone',
  'somewhere', 'nothing', 'nowhere', 'anything', 'anyone', 'anywhere'
]);

const getKeyWords = (text: string): string[] => {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 3 && !STOPWORDS.has(word));
};

const calculateScore = (userText: string, nasaText: string): { score: number; matchedWords: string[]; totalUserWords: number } => {
  const cleanText = (text: string) => 
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOPWORDS.has(word));
  
  const userWords = cleanText(userText);
  const nasaWords = new Set(cleanText(nasaText));
  
  const matchedWords = userWords.filter(word => nasaWords.has(word));
  const uniqueMatches = [...new Set(matchedWords)];
  
  return {
    score: uniqueMatches.length,
    matchedWords: uniqueMatches,
    totalUserWords: userWords.length
  };
};

const SpaceGame = () => {
  const [apodData, setApodData] = useState<APODData | null>(null);
  const [loading, setLoading] = useState(false);
  const [userDescription, setUserDescription] = useState("");
  const [gameState, setGameState] = useState<"idle" | "playing" | "submitted">("idle");
  const [scoreData, setScoreData] = useState<{ score: number; matchedWords: string[]; totalUserWords: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [revealedHints, setRevealedHints] = useState<string[]>([]);

  const MAX_HINTS = 3;

  // Get unique key words from the NASA description for hints
  const hintWords = useMemo(() => {
    if (!apodData) return [];
    const words = getKeyWords(apodData.explanation);
    const uniqueWords = [...new Set(words)];
    // Shuffle and pick words that are at least 4 characters
    return uniqueWords
      .filter(w => w.length >= 4)
      .sort(() => Math.random() - 0.5);
  }, [apodData]);

  const handleUseHint = () => {
    if (hintsUsed >= MAX_HINTS || hintsUsed >= hintWords.length) return;
    
    const nextHint = hintWords[hintsUsed];
    setRevealedHints(prev => [...prev, nextHint]);
    setHintsUsed(prev => prev + 1);
  };

  const fetchAPOD = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUserDescription("");
    setScoreData(null);
    setHintsUsed(0);
    setRevealedHints([]);
    
    const date = getRandomDate();
    
    try {
      const response = await fetch(
        `https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&date=${date}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch from NASA API");
      }
      
      const data: APODData = await response.json();
      
      if (data.media_type !== "image") {
        // Try again if it's a video
        fetchAPOD();
        return;
      }
      
      setApodData(data);
      setGameState("playing");
    } catch (err) {
      setError("Failed to load image. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = () => {
    if (!apodData || !userDescription.trim()) return;
    
    const result = calculateScore(userDescription, apodData.explanation);
    setScoreData(result);
    setGameState("submitted");
  };

  const handlePlayAgain = () => {
    setGameState("idle");
    setApodData(null);
    setScoreData(null);
    setUserDescription("");
    setHintsUsed(0);
    setRevealedHints([]);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="starfield" />
      
      <div className="relative z-10 container mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <header className="text-center mb-8 md:mb-12 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Rocket className="w-8 h-8 md:w-10 md:h-10 text-primary animate-float" />
            <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground tracking-tight">
              Cosmic Caption
            </h1>
            <Star className="w-6 h-6 md:w-8 md:h-8 text-accent" />
          </div>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            Describe NASA's Astronomy Picture of the Day and see how well you match the official description
          </p>
        </header>

        {/* Game Content */}
        <main className="max-w-4xl mx-auto">
          {gameState === "idle" && (
            <div className="text-center animate-scale-in">
              <div className="bg-card/50 backdrop-blur-md rounded-2xl p-8 md:p-12 border border-border/50">
                <Sparkles className="w-16 h-16 text-primary mx-auto mb-6 animate-pulse-glow" />
                <h2 className="font-display text-2xl md:text-3xl font-semibold mb-4 text-foreground">
                  Ready to explore the cosmos?
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  We'll show you a random NASA image from the past. Your challenge: describe what you see!
                </p>
                <Button 
                  variant="cosmic" 
                  size="xl" 
                  onClick={fetchAPOD}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-5 h-5" />
                      Start Game
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center text-destructive bg-destructive/10 rounded-lg p-4 mb-6">
              {error}
              <Button variant="outline" size="sm" className="ml-4" onClick={fetchAPOD}>
                Try Again
              </Button>
            </div>
          )}

          {gameState === "playing" && apodData && (
            <div className="space-y-6 animate-fade-in">
              {/* Image Card */}
              <div className="bg-card/50 backdrop-blur-md rounded-2xl overflow-hidden border border-border/50">
                <div className="relative aspect-video md:aspect-[16/10] overflow-hidden">
                  <img
                    src={apodData.url}
                    alt="NASA Astronomy Picture of the Day"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card to-transparent p-4 md:p-6">
                    <p className="text-muted-foreground text-sm">{apodData.date}</p>
                  </div>
                </div>
              </div>

              {/* Hints Section */}
              <div className="bg-card/50 backdrop-blur-md rounded-2xl p-4 md:p-6 border border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-accent" />
                    <span className="font-display font-semibold text-foreground">Hints</span>
                    <span className="text-muted-foreground text-sm">({MAX_HINTS - hintsUsed} remaining)</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUseHint}
                    disabled={hintsUsed >= MAX_HINTS || hintsUsed >= hintWords.length}
                    className="border-accent/50 text-accent hover:bg-accent/10"
                  >
                    <Lightbulb className="w-4 h-4 mr-1" />
                    Get Hint
                  </Button>
                </div>
                {revealedHints.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {revealedHints.map((hint, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-accent/20 text-accent rounded-full text-sm font-medium animate-scale-in"
                      >
                        {hint}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Need help? Use hints to reveal key words from NASA's description.
                  </p>
                )}
              </div>

              {/* Input Section */}
              <div className="bg-card/50 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-border/50">
                <label className="block text-foreground font-display font-semibold text-lg mb-3">
                  Describe what you see in this image:
                </label>
                <Textarea
                  value={userDescription}
                  onChange={(e) => setUserDescription(e.target.value)}
                  placeholder="Write your description of this cosmic scene..."
                  className="mb-4 min-h-[120px]"
                />
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">
                    {userDescription.trim().split(/\s+/).filter(w => w.length > 0).length} words
                  </p>
                  <Button 
                    variant="cosmic" 
                    size="lg"
                    onClick={handleSubmit}
                    disabled={!userDescription.trim()}
                  >
                    <Send className="w-4 h-4" />
                    Submit
                  </Button>
                </div>
              </div>
            </div>
          )}

          {gameState === "submitted" && apodData && scoreData && (
            <div className="space-y-6 animate-fade-in">
              {/* Score Card */}
              <div className="bg-card/50 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-border/50 text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-score mb-6 shadow-glow-secondary">
                  <span className="font-display text-4xl md:text-5xl font-bold text-foreground">
                    {scoreData.score}
                  </span>
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
                  Words Matched!
                </h2>
                <p className="text-muted-foreground mb-4">
                  You used {scoreData.totalUserWords} meaningful words, {scoreData.score} matched NASA's description
                  {hintsUsed > 0 && <span className="text-accent"> (used {hintsUsed} hint{hintsUsed > 1 ? 's' : ''})</span>}
                </p>
                
                {scoreData.matchedWords.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm text-muted-foreground mb-2">Matching words:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {scoreData.matchedWords.slice(0, 20).map((word, i) => (
                        <span 
                          key={i}
                          className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium"
                        >
                          {word}
                        </span>
                      ))}
                      {scoreData.matchedWords.length > 20 && (
                        <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-sm">
                          +{scoreData.matchedWords.length - 20} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <Button variant="cosmic" size="lg" onClick={handlePlayAgain}>
                  <RefreshCw className="w-4 h-4" />
                  Play Again
                </Button>
              </div>

              {/* Reveal Section */}
              <div className="bg-card/50 backdrop-blur-md rounded-2xl overflow-hidden border border-border/50">
                <div className="relative aspect-video md:aspect-[16/10] overflow-hidden">
                  <img
                    src={apodData.url}
                    alt={apodData.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 md:p-8">
                  <h3 className="font-display text-xl md:text-2xl font-bold text-foreground mb-2">
                    {apodData.title}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">{apodData.date}</p>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-primary mb-2">Your Description:</h4>
                      <p className="text-foreground/80 bg-muted/30 rounded-lg p-4 text-sm">
                        {userDescription}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-accent mb-2">NASA's Description:</h4>
                      <p className="text-foreground/80 bg-muted/30 rounded-lg p-4 text-sm leading-relaxed">
                        {apodData.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="text-center mt-12 text-muted-foreground text-sm">
          <p>Powered by NASA's Astronomy Picture of the Day API</p>
        </footer>
      </div>
    </div>
  );
};

export default SpaceGame;