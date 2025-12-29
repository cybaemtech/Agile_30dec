import { Check, UserMinus, UserPlus } from "lucide-react";
import React from "react";

export const InactivateIcon = () => <UserMinus className="h-4 w-4" title="Inactivate user" />;
export const ActivateIcon = () => <UserPlus className="h-4 w-4" title="Activate user" />;
export const InactiveIcon = () => <Check className="h-4 w-4 text-gray-400" title="Inactive" />;
