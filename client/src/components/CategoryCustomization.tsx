import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import * as Icons from "lucide-react";

// Type definitions
interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
}

// Available icons from lucide-react
const availableIcons = Object.keys(Icons).filter(
  (key) => typeof Icons[key as keyof typeof Icons] === "function"
);

// Available colors for categories
const categoryColors = [
  { name: "Slate", value: "bg-slate-500" },
  { name: "Red", value: "bg-red-500" },
  { name: "Orange", value: "bg-orange-500" },
  { name: "Amber", value: "bg-amber-500" },
  { name: "Yellow", value: "bg-yellow-500" },
  { name: "Lime", value: "bg-lime-500" },
  { name: "Green", value: "bg-green-500" },
  { name: "Emerald", value: "bg-emerald-500" },
  { name: "Teal", value: "bg-teal-500" },
  { name: "Cyan", value: "bg-cyan-500" },
  { name: "Sky", value: "bg-sky-500" },
  { name: "Blue", value: "bg-blue-500" },
  { name: "Indigo", value: "bg-indigo-500" },
  { name: "Violet", value: "bg-violet-500" },
  { name: "Purple", value: "bg-purple-500" },
  { name: "Fuchsia", value: "bg-fuchsia-500" },
  { name: "Pink", value: "bg-pink-500" },
  { name: "Rose", value: "bg-rose-500" },
];

const formSchema = z.object({
  name: z.string().min(1, "Category name is required"),
  icon: z.string().min(1, "Please select an icon"),
  color: z.string().min(1, "Please select a color"),
});

type FormData = z.infer<typeof formSchema>;

export default function CategoryCustomization() {
  const [selectedIcon, setSelectedIcon] = useState<string>("Shopping");
  const queryClient = useQueryClient();

  // Fetch existing categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Create new category mutation
  const createCategory = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      form.reset();
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      icon: "Shopping",
      color: "bg-blue-500",
    },
  });

  const onSubmit = (data: FormData) => {
    createCategory.mutate(data);
  };

  // Helper function to render icon component
  const renderIcon = (iconName: string) => {
    const IconComponent = Icons[iconName as keyof typeof Icons] as React.ComponentType<any>;
    return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Customization</CardTitle>
        <CardDescription>
          Create and customize your budget categories
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Existing Categories */}
          <div className="space-y-4">
            <h3 className="font-medium">Existing Categories</h3>
            <div className="grid grid-cols-2 gap-4">
              {categoriesLoading ? (
                <div className="col-span-2 flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : categories.length > 0 ? (
                categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center gap-2 p-2 rounded-lg border"
                  >
                    <div className={`p-2 rounded-md ${category.color}`}>
                      {renderIcon(category.icon)}
                    </div>
                    <span>{category.name}</span>
                  </div>
                ))
              ) : (
                <p className="col-span-2 text-center text-sm text-muted-foreground">
                  No categories yet. Create your first one below.
                </p>
              )}
            </div>
          </div>

          {/* New Category Form */}
          <div>
            <h3 className="font-medium mb-4">Add New Category</h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Groceries" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedIcon(value);
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>
                              {field.value && (
                                <div className="flex items-center gap-2">
                                  {renderIcon(field.value)}
                                  <span>{field.value}</span>
                                </div>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="h-[300px]">
                          {availableIcons.map((icon) => (
                            <SelectItem key={icon} value={icon}>
                              <div className="flex items-center gap-2">
                                {renderIcon(icon)}
                                <span>{icon}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`h-4 w-4 rounded ${field.value}`}
                                />
                                <span>
                                  {categoryColors.find((c) => c.value === field.value)?.name}
                                </span>
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoryColors.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`h-4 w-4 rounded ${color.value}`}
                                />
                                <span>{color.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createCategory.isPending}
                >
                  {createCategory.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Category
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}