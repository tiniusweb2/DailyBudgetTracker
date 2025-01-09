import * as tf from '@tensorflow/tfjs-node';
import natural from 'natural';
import { db } from '@db';
import { categories } from '@db/schema';
import { eq } from 'drizzle-orm';

const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

export class CategoryPredictionService {
  private model: tf.LayersModel | null = null;
  private categories: string[] = [];
  
  constructor() {
    this.loadCategories();
  }

  private async loadCategories() {
    const categoryList = await db.select().from(categories);
    this.categories = categoryList.map(c => c.name);
  }

  private preprocessText(description: string): number[] {
    // Simple bag of words approach
    const tokens = tokenizer.tokenize(description.toLowerCase()) || [];
    const stems = tokens.map(token => stemmer.stem(token));
    
    // Create a simple feature vector based on common expense-related terms
    const features = [
      stems.some(s => ['food', 'eat', 'restaurant', 'meal', 'groceri'].includes(s)) ? 1 : 0,
      stems.some(s => ['transport', 'bus', 'train', 'taxi', 'uber'].includes(s)) ? 1 : 0,
      stems.some(s => ['util', 'electr', 'water', 'gas', 'internet'].includes(s)) ? 1 : 0,
      stems.some(s => ['entertain', 'movi', 'game', 'music', 'show'].includes(s)) ? 1 : 0,
      stems.some(s => ['shop', 'cloth', 'shoe', 'retail'].includes(s)) ? 1 : 0,
    ];
    
    return features;
  }

  async predictCategory(description: string): Promise<{ categoryId: number; confidence: number }> {
    const features = this.preprocessText(description);
    
    // For now, use rule-based categorization
    // In a real application, this would use the TensorFlow model
    const maxIndex = features.indexOf(Math.max(...features));
    
    // Map the index to category IDs (these should match your seeded categories)
    const categoryMap = {
      0: 1, // Food
      1: 2, // Transportation
      2: 3, // Utilities
      3: 4, // Entertainment
      4: 5, // Shopping
    };
    
    // Get the predicted category
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryMap[maxIndex as keyof typeof categoryMap]))
      .limit(1);
    
    return {
      categoryId: category.id,
      confidence: features[maxIndex],
    };
  }
}

// Export a singleton instance
export const categoryPredictor = new CategoryPredictionService();
