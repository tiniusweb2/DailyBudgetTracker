import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Link } from "lucide-react";

// @ts-ignore
import { usePlaidLink } from "react-plaid-link";

export default function BankLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: getLinkToken, isPending: isGettingToken } = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/plaid/link/token", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      setLinkToken(data.link_token);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const { mutate: linkBank, isPending: isLinking } = useMutation({
    mutationFn: async (data: { publicToken: string; institutionName: string }) => {
      const response = await fetch("/api/plaid/link/bank", {
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
      queryClient.invalidateQueries({ queryKey: ['/api/income-sources'] });
      toast({
        title: "Success",
        description: "Bank account linked successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token: string, metadata: any) => {
      linkBank({
        publicToken: public_token,
        institutionName: metadata.institution.name,
      });
    },
  });

  const handleClick = () => {
    if (!linkToken) {
      getLinkToken();
    } else if (ready) {
      open();
    }
  };

  const isPending = isGettingToken || isLinking;

  return (
    <Button 
      onClick={handleClick} 
      disabled={isPending}
      className="w-full"
    >
      {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
      <Link className="h-4 w-4 mr-2" />
      Link Bank Account
    </Button>
  );
}
