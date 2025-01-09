import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Category } from "@db/schema";

interface CreateCategoryInput {
  name: string;
  color: string;
}

export function useCategories() {
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const createCategory = useMutation({
    mutationFn: async (data: CreateCategoryInput) => {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    },
  });

  return {
    categories,
    isLoading,
    createCategory: createCategory.mutateAsync,
  };
}
