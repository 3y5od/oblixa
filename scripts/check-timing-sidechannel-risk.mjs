#!/usr/bin/env node
import { runGenericSecurityCheck } from "./security-check-generic.mjs";
runGenericSecurityCheck(import.meta.url);
