import natural from 'natural';
import { db } from '@db';
import { categories } from '@db/schema';
import { eq } from 'drizzle-orm';

const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

interface CategoryPrediction {
  categoryId: number;
  confidence: number;
}

export class CategoryPredictionService {
  private categoryMap: Map<string, number> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.loadCategories();
  }

  private async loadCategories() {
    const categoryList = await db.select().from(categories);
    for (const category of categoryList) {
      this.categoryMap.set(category.name.toLowerCase(), category.id);
    }
    this.initialized = true;
  }

  private preprocessText(text: string): string[] {
    const tokens = tokenizer.tokenize(text.toLowerCase()) || [];
    return tokens.map(token => stemmer.stem(token));
  }

  private calculateConfidence(stems: string[], targetTerms: string[]): number {
    let matches = 0;
    for (const term of targetTerms) {
      if (stems.some(stem => stem.includes(term) || term.includes(stem))) {
        matches++;
      }
    }
    return matches / targetTerms.length;
  }

  async predictCategory(description: string): Promise<CategoryPrediction> {
    if (!this.initialized) {
      await this.loadCategories();
    }

    const stems = this.preprocessText(description);

    // Keywords for each category
    const categoryKeywords = {
      'food & dining': ['food', 'eat', 'restaurant', 'meal', 'groceri', 'dinner', 'lunch', 'breakfast', 'cafe', 'snack'],
      'transportation': ['transport', 'bus', 'train', 'taxi', 'uber', 'ride', 'gas', 'fare', 'metro', 'car'],
      'utilities': ['util', 'electr', 'water', 'gas', 'internet', 'phone', 'bill', 'wifi'],
      'entertainment': ['entertain', 'movi', 'game', 'music', 'show', 'concert', 'theater', 'sport'],
      'shopping': ['shop', 'cloth', 'shoe', 'retail', 'store', 'mall', 'market', 'buy']
    };

    let bestMatch = {
      category: 'food & dining',
      confidence: 0
    };

    // Calculate confidence for each category
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const confidence = this.calculateConfidence(stems, keywords);
      if (confidence > bestMatch.confidence) {
        bestMatch = { category, confidence };
      }
    }

    const categoryId = this.categoryMap.get(bestMatch.category);
    if (!categoryId) {
      throw new Error(`Category not found: ${bestMatch.category}`);
    }

    return {
      categoryId,
      confidence: Math.max(bestMatch.confidence, 0.1) // Ensure minimum confidence of 0.1
    };
  }
}

// Export a singleton instance
export const categoryPredictor = new CategoryPredictionService();